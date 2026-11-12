import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  EstoquePecaFuncionario,
  GastoVariavel,
  Loja,
  Maquina,
  Manutencao,
  ManutencaoPeca,
  ManutencaoPecaQuebrada,
  ManutencaoUsuario,
  Peca,
  Usuario,
} from "../models/index.js";
import { normalizarStatusOperacao } from "./maquinaController.js";
import { temAcao, ehPerfilAcessoTotal, lerAjustes } from "../permissoes/acessos.js";

// Máquina fica "em manutenção" enquanto tiver alguma nesses status
const STATUS_ABERTOS = ["PENDENTE", "ACEITA", "AGUARDANDO"];
const STATUS_VALIDOS = [...STATUS_ABERTOS, "CONCLUIDA", "FINALIZADA"];
// Perfis que não recebem manutenção como setor
const PERFIS_FORA_DO_SETOR = ["ADMIN", "DESENVOLVEDOR"];
const DIAS_RECORRENCIA = 30;
const MINIMO_RECENTES_RECORRENCIA = 3;
const MINIMO_MESMO_TIPO_RECORRENCIA = 2;

const includeAdmin = [
  {
    model: Usuario,
    as: "criadoPor",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Usuario,
    as: "resolvidoPor",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Usuario,
    as: "responsavel",
    attributes: ["id", "nome", "email"],
  },
  { model: Usuario, as: "destinatario", attributes: ["id", "nome", "role"] },
  { model: Usuario, as: "aceitaPor", attributes: ["id", "nome", "role"] },
  { model: Usuario, as: "finalizadaPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "autorizadaPor", attributes: ["id", "nome"] },
  {
    model: Usuario,
    as: "funcionariosPermitidos",
    attributes: ["id", "nome", "email"],
    through: { attributes: [] },
  },
  {
    model: Loja,
    as: "loja",
    attributes: ["id", "nome"],
  },
  {
    model: Maquina,
    as: "maquina",
    attributes: ["id", "codigo", "nome", "tipo", "statusOperacao"],
  },
  {
    model: ManutencaoPeca,
    as: "pecasUsadas",
    include: [
      { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
      { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
    ],
  },
  {
    model: Peca,
    as: "pecaPlanejada",
    attributes: ["id", "codigo", "nome", "unidade"],
  },
  {
    model: Usuario,
    as: "pecaPlanejadaFuncionario",
    attributes: ["id", "nome"],
  },
  {
    model: ManutencaoPecaQuebrada,
    as: "pecasQuebradas",
    include: [
      { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
      { model: Usuario, as: "funcionario", attributes: ["id", "nome"] },
    ],
  },
];

// Mesmo critério usado para atualizar status: admin/dev, o responsável ou
// quem está na lista de funcionários permitidos da manutenção.
const usuarioPodeAgirNaManutencao = (manutencao, usuario) =>
  temAcao(usuario, "manutencao.gerenciarTodas") ||
  manutencao.aceitaPorId === usuario.id ||
  manutencao.responsavelId === usuario.id ||
  (manutencao.funcionariosPermitidos || []).some(
    (permitido) => permitido.id === usuario.id,
  );

// Deduz a peça do carrinho (estoque) do funcionário informado e registra o
// uso na manutenção. Usada tanto na criação da manutenção (peça já
// selecionada de cara) quanto no registro de uso posterior. Retorna
// { error, status } em caso de falha (nada é lançado) pra quem chamou poder
// decidir se dá rollback só disso ou da transação inteira.
const registrarUsoDePecaInterno = async ({
  manutencaoId,
  pecaId,
  quantidade,
  funcionarioId,
  observacao,
  transaction,
}) => {
  const quantidadeNumerica = Number(quantidade);

  if (!pecaId) {
    return { status: 400, error: "Selecione a peça utilizada" };
  }

  if (!funcionarioId) {
    return {
      status: 400,
      error: "Selecione o funcionário que vai usar a peça",
    };
  }

  if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
    return {
      status: 400,
      error: "Informe uma quantidade válida (inteiro maior que zero)",
    };
  }

  const peca = await Peca.findByPk(pecaId, { transaction });
  if (!peca) {
    return { status: 400, error: "Peça informada não encontrada" };
  }

  const estoqueFuncionario = await EstoquePecaFuncionario.findOne({
    where: { funcionarioId, pecaId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const disponivel = estoqueFuncionario?.quantidade || 0;
  if (disponivel < quantidadeNumerica) {
    return {
      status: 400,
      error: `O funcionário não tem estoque suficiente dessa peça no carrinho. Disponível: ${disponivel}, solicitado: ${quantidadeNumerica}.`,
    };
  }

  await estoqueFuncionario.update(
    { quantidade: disponivel - quantidadeNumerica },
    { transaction },
  );

  await ManutencaoPeca.create(
    {
      manutencaoId,
      pecaId,
      quantidade: quantidadeNumerica,
      usuarioId: funcionarioId,
      observacao: observacao || null,
    },
    { transaction },
  );

  return null;
};

// Recalcula o statusOperacao da máquina a partir das manutenções em aberto.
const sincronizarStatusMaquina = async (maquinaId, transaction) => {
  if (!maquinaId) return;

  const maquina = await Maquina.findByPk(maquinaId, { transaction });
  if (!maquina) return;

  const manutencoesAbertas = await Manutencao.count({
    where: { maquinaId, status: { [Op.in]: STATUS_ABERTOS } },
    transaction,
  });

  if (manutencoesAbertas > 0) {
    if (maquina.statusOperacao !== "EM_MANUTENCAO") {
      await maquina.update({ statusOperacao: "EM_MANUTENCAO" }, { transaction });
    }
    return;
  }

  if (maquina.statusOperacao === "EM_MANUTENCAO") {
    const statusRestaurado = normalizarStatusOperacao({
      lojaId: maquina.lojaId,
      statusOperacao: undefined,
    });
    await maquina.update({ statusOperacao: statusRestaurado }, { transaction });
  }
};

// Avalia se a máquina está com manutenção repetida (recorrente).
const avaliarRecorrencia = async (maquinaId, tipoProblema, transaction) => {
  if (!maquinaId) return { recorrente: false, motivos: [] };

  const motivos = [];

  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_RECORRENCIA);

  const recentes = await Manutencao.count({
    where: { maquinaId, createdAt: { [Op.gte]: desde } },
    transaction,
  });

  if (recentes >= MINIMO_RECENTES_RECORRENCIA) {
    motivos.push(
      `Esta máquina já teve ${recentes} manutenções nos últimos ${DIAS_RECORRENCIA} dias.`,
    );
  }

  if (tipoProblema) {
    const mesmoTipo = await Manutencao.count({
      where: { maquinaId, tipoProblema },
      transaction,
    });

    if (mesmoTipo >= MINIMO_MESMO_TIPO_RECORRENCIA) {
      motivos.push(
        `O problema "${tipoProblema}" já se repetiu ${mesmoTipo} vezes nesta máquina.`,
      );
    }
  }

  return { recorrente: motivos.length > 0, motivos };
};

const DIAS_ABERTA_SEM_PRAZO_ALERTA = 15;

// --- ALERTA: MANUTENÇÃO EM ABERTO HÁ MUITO TEMPO ---
export const alertasManutencaoAtrasada = async (req, res) => {
  try {
    const manutencoes = await Manutencao.findAll({
      where: { status: { [Op.in]: STATUS_ABERTOS } },
      include: [
        { model: Maquina, as: "maquina", attributes: ["id", "codigo", "nome"] },
        { model: Loja, as: "loja", attributes: ["id", "nome"] },
      ],
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const alertas = manutencoes
      .map((manutencao) => {
        const diasAberta = Math.floor(
          (hoje - new Date(manutencao.createdAt)) / (1000 * 60 * 60 * 24),
        );
        const prazoVencido =
          manutencao.prazo && new Date(manutencao.prazo) < hoje;
        const abertaSemPrazo =
          !manutencao.prazo && diasAberta >= DIAS_ABERTA_SEM_PRAZO_ALERTA;

        if (!prazoVencido && !abertaSemPrazo) return null;

        return {
          id: manutencao.id,
          titulo: manutencao.titulo,
          status: manutencao.status,
          maquina: manutencao.maquina
            ? {
                id: manutencao.maquina.id,
                codigo: manutencao.maquina.codigo,
                nome: manutencao.maquina.nome,
              }
            : null,
          loja: manutencao.loja
            ? { id: manutencao.loja.id, nome: manutencao.loja.nome }
            : null,
          prazo: manutencao.prazo,
          diasAberta,
          mensagem: prazoVencido
            ? `Prazo vencido (era ${manutencao.prazo})`
            : `Aberta há ${diasAberta} dias sem prazo definido`,
          createdAt: manutencao.createdAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.diasAberta - a.diasAberta);

    res.json({ totalAlertas: alertas.length, alertas });
  } catch (error) {
    console.error("Erro ao buscar alertas de manutenção atrasada:", error);
    res
      .status(500)
      .json({ error: "Erro ao buscar alertas de manutenção atrasada" });
  }
};

// --- ALERTA: MANUTENÇÃO REPETIDA (MÁQUINAS COM MANUTENÇÃO EM ABERTO) ---
export const alertasManutencaoRecorrente = async (req, res) => {
  try {
    const manutencoesAbertas = await Manutencao.findAll({
      where: { status: { [Op.in]: STATUS_ABERTOS }, maquinaId: { [Op.ne]: null } },
      include: [
        { model: Maquina, as: "maquina", attributes: ["id", "codigo", "nome"] },
      ],
    });

    const maquinasVistas = new Set();
    const alertas = [];

    for (const manutencao of manutencoesAbertas) {
      if (maquinasVistas.has(manutencao.maquinaId)) continue;
      maquinasVistas.add(manutencao.maquinaId);

      const { recorrente, motivos } = await avaliarRecorrencia(
        manutencao.maquinaId,
        manutencao.tipoProblema,
      );

      if (recorrente) {
        alertas.push({
          maquina: manutencao.maquina
            ? {
                id: manutencao.maquina.id,
                codigo: manutencao.maquina.codigo,
                nome: manutencao.maquina.nome,
              }
            : null,
          titulo: "Manutenção recorrente",
          motivos,
          mensagem: motivos.join(" "),
        });
      }
    }

    res.json({ totalAlertas: alertas.length, alertas });
  } catch (error) {
    console.error("Erro ao buscar alertas de manutenção recorrente:", error);
    res
      .status(500)
      .json({ error: "Erro ao buscar alertas de manutenção recorrente" });
  }
};

export const listarFuncionariosManutencao = async (req, res) => {
  try {
    const funcionarios = await Usuario.findAll({
      where: {
        role: "FUNCIONARIO",
        ativo: true,
      },
      attributes: ["id", "nome", "email"],
      order: [["nome", "ASC"]],
    });

    res.json(funcionarios);
  } catch (error) {
    console.error("Erro ao listar funcionários para manutenção:", error);
    res.status(500).json({ error: "Erro ao listar funcionários" });
  }
};

export const criarManutencao = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      titulo,
      descricao,
      funcionariosIds,
      custo,
      lojaId,
      maquinaId,
      responsavelId,
      tipoProblema,
      prazo,
      pecaPlanejada,
      setor,
      destinatarioId,
    } = req.body;

    if (!titulo || !descricao) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });
    }

    // Quem autoriza (Admin/Cadastro) já manda pra um setor ou pessoa; os
    // outros só solicitam e a solicitação espera autorização
    const jaAutorizada = podeAutorizar(req.usuario);
    const destino = jaAutorizada
      ? await validarDestino({ setor, destinatarioId, transaction })
      : { setor: null, destinatarioId: null };
    if (destino.erro) {
      await transaction.rollback();
      return res.status(400).json({ error: destino.erro });
    }

    // Lista antiga de funcionários: opcional (telas antigas ainda mandam)
    const idsUnicos = [...new Set((Array.isArray(funcionariosIds) ? funcionariosIds : []).filter(Boolean))];

    const pecaPlanejadaValida =
      pecaPlanejada && pecaPlanejada.pecaId && pecaPlanejada.quantidade;
    const pecaPlanejadaQuantidadeNumerica = pecaPlanejadaValida
      ? Number(pecaPlanejada.quantidade)
      : null;

    if (pecaPlanejadaValida) {
      if (!idsUnicos.includes(pecaPlanejada.funcionarioId)) {
        await transaction.rollback();
        return res.status(400).json({
          error:
            "O funcionário que vai usar a peça precisa estar entre os responsáveis pela manutenção",
        });
      }

      if (
        !Number.isInteger(pecaPlanejadaQuantidadeNumerica) ||
        pecaPlanejadaQuantidadeNumerica <= 0
      ) {
        await transaction.rollback();
        return res.status(400).json({
          error:
            "Informe uma quantidade válida de peça (inteiro maior que zero)",
        });
      }

      const pecaExiste = await Peca.findByPk(pecaPlanejada.pecaId, {
        transaction,
      });
      if (!pecaExiste) {
        await transaction.rollback();
        return res.status(400).json({ error: "Peça informada não encontrada" });
      }
    }

    const custoInformado =
      custo !== undefined && custo !== null && custo !== "";
    const custoNumerico = custoInformado
      ? Number(String(custo).replace(",", "."))
      : null;

    if (
      custoInformado &&
      (!Number.isFinite(custoNumerico) || custoNumerico < 0)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error:
          "Custo inválido. Informe um valor numérico maior ou igual a zero.",
      });
    }

    // Só ADMIN pode informar custo na manutenção — é o que gera o gasto
    // variável automático, e isso fica restrito a quem tem acesso a
    // financeiro (FUNCIONARIO_CADASTRO cria manutenção, mas não financeiro).
    if (custoInformado && custoNumerico > 0 && !temAcao(req.usuario, "manutencao.lancarCusto")) {
      await transaction.rollback();
      return res.status(403).json({
        error: "Você não tem acesso para informar custo na manutenção.",
      });
    }

    let maquina = null;
    if (maquinaId) {
      maquina = await Maquina.findByPk(maquinaId, { transaction });
      if (!maquina) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Máquina informada não encontrada" });
      }
    }

    // Manutenção de uma máquina pertence à loja dessa máquina.
    const lojaIdFinal = maquina ? maquina.lojaId : lojaId || null;

    if (custoInformado && custoNumerico > 0 && !lojaIdFinal) {
      await transaction.rollback();
      return res.status(400).json({
        error:
          "Selecione uma loja (ou uma máquina vinculada a uma loja) para registrar o gasto variável da manutenção.",
      });
    }

    const funcionarios = idsUnicos.length
      ? await Usuario.findAll({
          where: { id: { [Op.in]: idsUnicos }, ativo: true },
          attributes: ["id"],
          transaction,
        })
      : [];

    if (funcionarios.length !== idsUnicos.length) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Um ou mais funcionários informados são inválidos ou inativos",
      });
    }

    if (responsavelId) {
      const responsavel = await Usuario.findOne({
        where: { id: responsavelId, role: "FUNCIONARIO", ativo: true },
        attributes: ["id"],
        transaction,
      });

      if (!responsavel) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Funcionário responsável inválido ou inativo",
        });
      }
    }

    if (lojaIdFinal && !maquina) {
      const loja = await Loja.findByPk(lojaIdFinal, { transaction });
      if (!loja) {
        await transaction.rollback();
        return res.status(400).json({ error: "Loja informada não encontrada" });
      }
    }

    const manutencao = await Manutencao.create(
      {
        titulo,
        descricao,
        custo: custoInformado ? custoNumerico : null,
        lojaId: lojaIdFinal,
        maquinaId: maquina ? maquina.id : null,
        responsavelId: responsavelId || null,
        tipoProblema: tipoProblema || null,
        prazo: prazo || null,
        criadoPorId: req.usuario.id,
        status: jaAutorizada ? "PENDENTE" : "SOLICITADA",
        setor: destino.setor,
        destinatarioId: destino.destinatarioId,
        autorizadaPorId: jaAutorizada ? req.usuario.id : null,
        autorizadaEm: jaAutorizada ? new Date() : null,
        historico: [
          jaAutorizada
            ? eventoHistorico(req.usuario, "CRIADA", "PENDENTE", `Enviada para ${destino.rotulo}`)
            : eventoHistorico(req.usuario, "SOLICITADA", "SOLICITADA", "Aguardando autorização"),
        ],
        pecaPlanejadaId: pecaPlanejadaValida ? pecaPlanejada.pecaId : null,
        pecaPlanejadaFuncionarioId: pecaPlanejadaValida
          ? pecaPlanejada.funcionarioId
          : null,
        pecaPlanejadaQuantidade: pecaPlanejadaValida
          ? pecaPlanejadaQuantidadeNumerica
          : null,
        pecaPlanejadaObservacao: pecaPlanejadaValida
          ? pecaPlanejada.observacao || null
          : null,
      },
      { transaction },
    );

    await ManutencaoUsuario.bulkCreate(
      idsUnicos.map((usuarioId) => ({
        manutencaoId: manutencao.id,
        usuarioId,
      })),
      { transaction },
    );

    // A peça planejada só é descontada do carrinho quando a manutenção for
    // marcada como concluída (ver atualizarStatusManutencao) — aqui só fica
    // registrada a intenção, sem mexer em estoque ainda.

    if (custoInformado && custoNumerico > 0 && lojaIdFinal) {
      const agora = new Date();
      await GastoVariavel.create(
        {
          lojaId: lojaIdFinal,
          nome: `Manutenção - ${titulo}`,
          valor: custoNumerico,
          observacao: `Gerado automaticamente pela manutenção ${manutencao.id}${descricao ? ` | ${descricao}` : ""}`,
          dataInicio: agora,
          dataFim: agora,
        },
        { transaction },
      );
    }

    await sincronizarStatusMaquina(manutencao.maquinaId, transaction);
    const { recorrente, motivos } = await avaliarRecorrencia(
      manutencao.maquinaId,
      manutencao.tipoProblema,
      transaction,
    );

    await transaction.commit();

    const manutencaoCompleta = await Manutencao.findByPk(manutencao.id, {
      include: includeAdmin,
    });

    res.locals.entityId = manutencao.id;
    res.status(201).json({
      ...manutencaoCompleta.toJSON(),
      recorrente,
      recorrenciaMotivos: motivos,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao criar manutenção:", error);
    res.status(500).json({ error: "Erro ao criar manutenção" });
  }
};

// ---------- Fluxo: setor/pessoa, aceitar, aguardando, serviço, finalizar ----------

const NOMES_PERFIS = {
  FUNCIONARIO: "Funcionário",
  FUNCIONARIO_ESTOQUE: "Chefe de Expedição",
  FUNCIONARIO_CADASTRO: "Funcionário de Cadastro",
  CONSULTOR_VENDAS: "Consultor de Vendas",
  MOTORISTA: "Motorista",
  ABASTECEDOR: "Abastecedor",
  FINANCEIRO: "Financeiro",
};

// Quem autoriza solicitação de manutenção: Admin e Funcionário de Cadastro
// (ou quem ganhar a ação manutencao.autorizar nos acessos)
const podeAutorizar = (usuario) => {
  if (ehPerfilAcessoTotal(usuario?.role)) return true;
  const { adicionadas, removidas } = lerAjustes(usuario);
  if (removidas.includes("manutencao.autorizar")) return false;
  return usuario?.role === "FUNCIONARIO_CADASTRO" || adicionadas.includes("manutencao.autorizar");
};

const eventoHistorico = (usuario, acao, status, detalhe = null) => ({
  acao,
  status,
  usuarioId: usuario?.id || null,
  usuarioNome: usuario?.nome || null,
  em: new Date().toISOString(),
  detalhe,
});

const validarDestino = async ({ setor, destinatarioId, transaction }) => {
  if (destinatarioId) {
    const pessoa = await Usuario.findOne({
      where: { id: destinatarioId, ativo: true },
      attributes: ["id", "nome", "role"],
      transaction,
    });
    if (!pessoa) return { erro: "Pessoa escolhida não encontrada ou inativa." };
    return { setor: pessoa.role, destinatarioId: pessoa.id, rotulo: pessoa.nome };
  }
  const perfis = Usuario.getAttributes().role.values.filter((p) => !PERFIS_FORA_DO_SETOR.includes(p));
  if (!setor || !perfis.includes(setor)) {
    return { erro: "Escolha para qual setor ou pessoa vai a manutenção." };
  }
  return { setor, destinatarioId: null, rotulo: `o setor ${NOMES_PERFIS[setor] || setor}` };
};

// Setores (perfis com gente ativa) e pessoas, para escolher o destino
export const listarDestinosManutencao = async (req, res) => {
  try {
    const pessoas = await Usuario.findAll({
      where: { ativo: true, role: { [Op.notIn]: PERFIS_FORA_DO_SETOR } },
      attributes: ["id", "nome", "role"],
      order: [["nome", "ASC"]],
    });
    const setores = [...new Set(pessoas.map((p) => p.role))].map((valor) => ({
      valor,
      nome: NOMES_PERFIS[valor] || valor,
      pessoas: pessoas.filter((p) => p.role === valor).length,
    }));
    // Onde está o problema: qualquer um abre, então vai a lista de lojas e
    // máquinas ativas (sem o Depósito Principal)
    const [lojas, maquinas] = await Promise.all([
      Loja.findAll({ where: { ativo: true }, attributes: ["id", "nome"], order: [["nome", "ASC"]] }),
      Maquina.findAll({
        where: { ativo: true, lojaId: { [Op.ne]: null } },
        attributes: ["id", "codigo", "nome", "tipo", "lojaId"],
        order: [["codigo", "ASC"]],
      }),
    ]);
    res.json({
      setores,
      pessoas,
      lojas: lojas.filter((l) => !["deposito principal", "depósito principal"].includes(String(l.nome).trim().toLowerCase())),
      maquinas,
    });
  } catch (error) {
    console.error("Erro ao listar destinos de manutenção:", error);
    res.status(500).json({ error: "Erro ao carregar setores e pessoas" });
  }
};

// Carrega a manutenção travada (uma ação por vez) com o que as regras usam
const carregarParaAcao = (id, transaction) =>
  Manutencao.findByPk(id, {
    include: [{ model: Usuario, as: "funcionariosPermitidos", attributes: ["id"], through: { attributes: [] } }],
    transaction,
    lock: { level: transaction.LOCK.UPDATE, of: Manutencao },
  });

const podeVerPendente = (manutencao, usuario) => {
  if (manutencao.destinatarioId) return manutencao.destinatarioId === usuario.id;
  if (manutencao.setor) return manutencao.setor === usuario.role;
  return (
    manutencao.responsavelId === usuario.id ||
    (manutencao.funcionariosPermitidos || []).some((p) => p.id === usuario.id)
  );
};

const responderComManutencao = async (res, id) => {
  const atualizada = await Manutencao.findByPk(id, { include: includeAdmin });
  res.json(atualizada);
};

// Executa uma ação do fluxo numa transação: `regra` devolve { erro, status }
// ou os dados a gravar (+ evento do histórico)
const executarAcao = (nomeAcao, regra) => async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const manutencao = await carregarParaAcao(req.params.id, transaction);
    if (!manutencao) {
      await transaction.rollback();
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }
    const resultado = await regra({ manutencao, req, transaction });
    if (resultado.erro) {
      await transaction.rollback();
      return res.status(resultado.status || 400).json({ error: resultado.erro });
    }
    const { dados, evento } = resultado;
    await manutencao.update(
      { ...dados, historico: [...(manutencao.historico || []), evento] },
      { transaction },
    );
    await sincronizarStatusMaquina(manutencao.maquinaId, transaction);
    await transaction.commit();
    res.locals.entityId = manutencao.id;
    return responderComManutencao(res, manutencao.id);
  } catch (error) {
    await transaction.rollback();
    console.error(`Erro ao ${nomeAcao} manutenção:`, error);
    res.status(500).json({ error: `Erro ao ${nomeAcao} a manutenção` });
  }
};

// Solicitada -> Pendente: Cadastro/admin autoriza escolhendo setor ou pessoa
export const autorizarManutencao = executarAcao("autorizar", async ({ manutencao, req, transaction }) => {
  if (!podeAutorizar(req.usuario)) return { erro: "Você não pode autorizar manutenções.", status: 403 };
  if (manutencao.status !== "SOLICITADA") return { erro: "Essa solicitação já foi analisada.", status: 409 };
  const destino = await validarDestino({ ...req.body, transaction });
  if (destino.erro) return { erro: destino.erro };
  const dados = {
    status: "PENDENTE",
    setor: destino.setor,
    destinatarioId: destino.destinatarioId,
    autorizadaPorId: req.usuario.id,
    autorizadaEm: new Date(),
  };
  if (req.body?.prazo) dados.prazo = req.body.prazo;
  return { dados, evento: eventoHistorico(req.usuario, "AUTORIZADA", "PENDENTE", `Enviada para ${destino.rotulo}`) };
});

// Solicitada -> Recusada (com motivo)
export const recusarManutencao = executarAcao("recusar", async ({ manutencao, req }) => {
  if (!podeAutorizar(req.usuario)) return { erro: "Você não pode recusar manutenções.", status: 403 };
  if (manutencao.status !== "SOLICITADA") return { erro: "Essa solicitação já foi analisada.", status: 409 };
  const motivo = String(req.body?.motivo || "").trim();
  if (motivo.length < 3) return { erro: "Diga por que a solicitação foi recusada." };
  return {
    dados: { status: "RECUSADA", motivoRecusa: motivo.slice(0, 1000), autorizadaPorId: req.usuario.id, autorizadaEm: new Date() },
    evento: eventoHistorico(req.usuario, "RECUSADA", "RECUSADA", motivo.slice(0, 300)),
  };
});

const ehDeQuemAceitou = (manutencao, usuario) =>
  manutencao.aceitaPorId === usuario.id || temAcao(usuario, "manutencao.gerenciarTodas");

// Pendente -> Aceita: o primeiro que aceitar fica com ela (some pros outros)
export const aceitarManutencao = executarAcao("aceitar", async ({ manutencao, req }) => {
  if (manutencao.status === "SOLICITADA") {
    return { erro: "Essa manutenção ainda não foi autorizada.", status: 409 };
  }
  if (manutencao.status !== "PENDENTE") {
    return { erro: "Essa manutenção já foi aceita por outra pessoa.", status: 409 };
  }
  if (!podeVerPendente(manutencao, req.usuario) && !temAcao(req.usuario, "manutencao.gerenciarTodas")) {
    return { erro: "Essa manutenção não foi enviada para você.", status: 403 };
  }
  return {
    dados: { status: "ACEITA", aceitaPorId: req.usuario.id, aceitaEm: new Date(), motivoAguardando: null },
    evento: eventoHistorico(req.usuario, "ACEITA", "ACEITA"),
  };
});

// Aceita -> Aguardando: não deu pra fazer (ex.: faltou peça); volta pro admin
export const aguardarManutencao = executarAcao("atualizar", async ({ manutencao, req }) => {
  const motivo = String(req.body?.motivo || "").trim();
  if (manutencao.status !== "ACEITA") return { erro: "Só dá para fazer isso numa manutenção aceita." };
  if (!ehDeQuemAceitou(manutencao, req.usuario)) return { erro: "Só quem aceitou pode fazer isso.", status: 403 };
  if (motivo.length < 3) return { erro: "Conte por que não deu para fazer (ex.: faltou peça)." };
  return {
    dados: { status: "AGUARDANDO", motivoAguardando: motivo.slice(0, 1000) },
    evento: eventoHistorico(req.usuario, "AGUARDANDO", "AGUARDANDO", motivo.slice(0, 300)),
  };
});

// Serviço de terceiro (ex.: serralheiro): fica anotado e segue aceita
export const solicitarServicoManutencao = executarAcao("atualizar", async ({ manutencao, req }) => {
  const servico = String(req.body?.servico || "").trim();
  if (manutencao.status !== "ACEITA") return { erro: "Só dá para solicitar serviço numa manutenção aceita." };
  if (!ehDeQuemAceitou(manutencao, req.usuario)) return { erro: "Só quem aceitou pode solicitar serviço.", status: 403 };
  if (servico.length < 3) return { erro: "Diga qual serviço foi solicitado (ex.: serralheiro)." };
  return {
    dados: { servicoExterno: servico.slice(0, 150), servicoSolicitadoEm: new Date() },
    evento: eventoHistorico(req.usuario, "SERVICO", "ACEITA", servico.slice(0, 150)),
  };
});

// Aceita -> Concluída: quem pegou terminou (desconta a peça planejada, se houver)
export const concluirManutencao = executarAcao("concluir", async ({ manutencao, req, transaction }) => {
  const feito = String(req.body?.observacao || "").trim();
  if (manutencao.status !== "ACEITA") return { erro: "Só dá para concluir uma manutenção aceita." };
  if (!ehDeQuemAceitou(manutencao, req.usuario)) return { erro: "Só quem aceitou pode concluir.", status: 403 };
  const dados = { status: "CONCLUIDA", resolvidoPorId: req.usuario.id, resolvidoEm: new Date() };
  if (manutencao.pecaPlanejadaId && !manutencao.pecaPlanejadaConsumida) {
    const resultadoPeca = await registrarUsoDePecaInterno({
      manutencaoId: manutencao.id,
      pecaId: manutencao.pecaPlanejadaId,
      quantidade: manutencao.pecaPlanejadaQuantidade,
      funcionarioId: manutencao.pecaPlanejadaFuncionarioId,
      observacao: manutencao.pecaPlanejadaObservacao,
      transaction,
    });
    if (resultadoPeca) return { erro: `Não foi possível concluir: ${resultadoPeca.error}`, status: resultadoPeca.status };
    dados.pecaPlanejadaConsumida = true;
  }
  return { dados, evento: eventoHistorico(req.usuario, "CONCLUIDA", "CONCLUIDA", feito.slice(0, 500) || null) };
});

// Admin: manda de novo para um setor ou pessoa (inclusive a mesma)
export const reenviarManutencao = executarAcao("reenviar", async ({ manutencao, req, transaction }) => {
  if (["CONCLUIDA", "FINALIZADA"].includes(manutencao.status)) {
    return { erro: "Essa manutenção já foi concluída." };
  }
  if (["SOLICITADA", "RECUSADA"].includes(manutencao.status)) {
    return { erro: "Essa solicitação ainda não foi autorizada." };
  }
  const destino = await validarDestino({ ...req.body, transaction });
  if (destino.erro) return { erro: destino.erro };
  const observacao = String(req.body?.observacao || "").trim();
  return {
    dados: {
      status: "PENDENTE",
      setor: destino.setor,
      destinatarioId: destino.destinatarioId,
      aceitaPorId: null,
      aceitaEm: null,
    },
    evento: eventoHistorico(
      req.usuario,
      "REENVIADA",
      "PENDENTE",
      `Para ${destino.rotulo}${observacao ? ` — ${observacao.slice(0, 200)}` : ""}`,
    ),
  };
});

// Admin: Concluída -> Finalizada, com o gasto obrigatório (pode ser R$ 0)
export const finalizarManutencao = executarAcao("finalizar", async ({ manutencao, req, transaction }) => {
  if (manutencao.status !== "CONCLUIDA") return { erro: "Só dá para finalizar uma manutenção concluída." };
  const textoValor = String(req.body?.custo ?? "").replace(",", ".").trim();
  const custo = textoValor === "" ? NaN : Number(textoValor);
  const descricao = String(req.body?.gastoDescricao || "").trim();
  if (!Number.isFinite(custo) || custo < 0) return { erro: "Informe o valor gasto (pode ser 0)." };
  if (descricao.length < 3) return { erro: "Descreva o que foi gasto (ou por que não teve gasto)." };
  const valor = Math.round(custo * 100) / 100;
  if (valor > 0) {
    if (!manutencao.lojaId) return { erro: "Essa manutenção não tem loja para lançar o gasto." };
    const agora = new Date();
    await GastoVariavel.create(
      {
        lojaId: manutencao.lojaId,
        nome: `Manutenção - ${manutencao.titulo}`.slice(0, 100),
        valor,
        observacao: `Gerado automaticamente pela manutenção ${manutencao.id} | ${descricao}`,
        dataInicio: agora,
        dataFim: agora,
        usuarioId: req.usuario.id,
      },
      { transaction },
    );
  }
  return {
    dados: {
      status: "FINALIZADA",
      custo: valor,
      gastoDescricao: descricao.slice(0, 1000),
      finalizadaPorId: req.usuario.id,
      finalizadaEm: new Date(),
    },
    evento: eventoHistorico(
      req.usuario,
      "FINALIZADA",
      "FINALIZADA",
      `Gasto R$ ${valor.toFixed(2).replace(".", ",")} — ${descricao.slice(0, 200)}`,
    ),
  };
});

export const listarManutencoes = async (req, res) => {
  try {
    const { status, dataInicio, dataFim, lojaId, maquinaId, tipoProblema, usuarioId } =
      req.query;
    let include = [...includeAdmin];
    const where = {};

    if (!temAcao(req.usuario, "manutencao.gerenciarTodas")) {
      // Pendente: quem é do setor (ou a pessoa escolhida). Depois de aceita,
      // só quem aceitou. Quem abriu acompanha a sua até ser finalizada.
      // Finalizada some; recusada fica 7 dias pra quem pediu ver o motivo
      where.status = { [Op.ne]: "FINALIZADA" };
      const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      where[Op.and] = [
        { [Op.or]: [{ status: { [Op.ne]: "RECUSADA" } }, { autorizadaEm: { [Op.gte]: seteDiasAtras } }] },
      ];
      where[Op.or] = [
        { aceitaPorId: req.usuario.id },
        { criadoPorId: req.usuario.id },
        { status: "PENDENTE", destinatarioId: req.usuario.id },
        { status: "PENDENTE", destinatarioId: null, setor: req.usuario.role },
        // Manutenções antigas (antes do setor): quem estava na lista
        { status: "PENDENTE", setor: null, destinatarioId: null, responsavelId: req.usuario.id },
        { status: "PENDENTE", setor: null, destinatarioId: null, "$funcionariosPermitidos.id$": req.usuario.id },
      ];
      include = includeAdmin.map((item) =>
        item.as === "funcionariosPermitidos" ? { ...item, required: false } : item,
      );
    } else {
      if (status && STATUS_VALIDOS.includes(status)) {
        where.status = status;
      }

      if (lojaId) {
        where.lojaId = lojaId;
      }

      if (maquinaId) {
        where.maquinaId = maquinaId;
      }

      if (tipoProblema) {
        where.tipoProblema = tipoProblema;
      }

      if (dataInicio || dataFim) {
        where.createdAt = {};

        if (dataInicio) {
          where.createdAt[Op.gte] = new Date(`${dataInicio}T00:00:00.000Z`);
        }

        if (dataFim) {
          where.createdAt[Op.lte] = new Date(`${dataFim}T23:59:59.999Z`);
        }
      }

      if (usuarioId) {
        include = include.map((item) => {
          if (item.as !== "funcionariosPermitidos") return item;
          return {
            ...item,
            where: { id: usuarioId },
            required: true,
          };
        });
      }
    }

    const manutencoes = await Manutencao.findAll({
      where,
      include,
      subQuery: false,
      order: [["createdAt", "DESC"]],
    });

    res.json(manutencoes);
  } catch (error) {
    console.error("Erro ao listar manutenções:", error);
    res.status(500).json({ error: "Erro ao listar manutenções" });
  }
};

export const atualizarStatusManutencao = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { status } = req.body;

    if (!STATUS_VALIDOS.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Status inválido" });
    }

    const manutencao = await Manutencao.findByPk(req.params.id, {
      include: [
        {
          model: Usuario,
          as: "funcionariosPermitidos",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
      transaction,
    });

    if (!manutencao) {
      await transaction.rollback();
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }

    const usuarioPermitido = usuarioPodeAgirNaManutencao(
      manutencao,
      req.usuario,
    );

    if (!usuarioPermitido) {
      await transaction.rollback();
      return res.status(403).json({
        error: "Você não tem permissão para atualizar esta manutenção",
      });
    }

    if (manutencao.status === status) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "A manutenção já está com este status" });
    }

    const dadosAtualizacao = { status };

    if (status === "CONCLUIDA") {
      dadosAtualizacao.resolvidoPorId = req.usuario.id;
      dadosAtualizacao.resolvidoEm = new Date();

      // Só agora a peça planejada na criação é efetivamente descontada do
      // carrinho do funcionário — se não tiver mais estoque suficiente
      // (mudou desde a criação), bloqueia a conclusão em vez de deixar a
      // manutenção "concluída" sem a peça de fato ter sido usada.
      if (manutencao.pecaPlanejadaId && !manutencao.pecaPlanejadaConsumida) {
        const resultadoPeca = await registrarUsoDePecaInterno({
          manutencaoId: manutencao.id,
          pecaId: manutencao.pecaPlanejadaId,
          quantidade: manutencao.pecaPlanejadaQuantidade,
          funcionarioId: manutencao.pecaPlanejadaFuncionarioId,
          observacao: manutencao.pecaPlanejadaObservacao,
          transaction,
        });

        if (resultadoPeca) {
          await transaction.rollback();
          return res.status(resultadoPeca.status).json({
            error: `Não foi possível concluir: ${resultadoPeca.error}`,
          });
        }

        dadosAtualizacao.pecaPlanejadaConsumida = true;
      }
    } else if (manutencao.status === "CONCLUIDA") {
      dadosAtualizacao.resolvidoPorId = null;
      dadosAtualizacao.resolvidoEm = null;
    }

    await manutencao.update(dadosAtualizacao, { transaction });
    await sincronizarStatusMaquina(manutencao.maquinaId, transaction);

    await transaction.commit();

    const manutencaoAtualizada = await Manutencao.findByPk(manutencao.id, {
      include: includeAdmin,
    });

    res.json(manutencaoAtualizada);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao atualizar status da manutenção:", error);
    res.status(500).json({ error: "Erro ao atualizar status da manutenção" });
  }
};

export const listarPecasUsadasManutencao = async (req, res) => {
  try {
    const manutencao = await Manutencao.findByPk(req.params.id);

    if (!manutencao) {
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }

    const pecasUsadas = await ManutencaoPeca.findAll({
      where: { manutencaoId: req.params.id },
      include: [
        { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
      order: [["dataUso", "DESC"]],
    });

    res.json(pecasUsadas);
  } catch (error) {
    console.error("Erro ao listar peças usadas na manutenção:", error);
    res.status(500).json({ error: "Erro ao listar peças usadas na manutenção" });
  }
};

export const registrarUsoPecaManutencao = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pecaId, quantidade, observacao, funcionarioId } = req.body;

    const manutencao = await Manutencao.findByPk(req.params.id, {
      include: [
        {
          model: Usuario,
          as: "funcionariosPermitidos",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
      transaction,
    });

    if (!manutencao) {
      await transaction.rollback();
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }

    if (!usuarioPodeAgirNaManutencao(manutencao, req.usuario)) {
      await transaction.rollback();
      return res.status(403).json({
        error: "Você não tem permissão para registrar uso de peça nesta manutenção",
      });
    }

    // Por padrão, quem registra deduz do próprio carrinho. Só admin/dev/
    // cadastro podem registrar em nome de outro funcionário.
    const funcionarioAlvo = funcionarioId || req.usuario.id;
    if (
      funcionarioAlvo !== req.usuario.id &&
      !temAcao(req.usuario, "manutencao.registrarPorOutro")
    ) {
      await transaction.rollback();
      return res.status(403).json({
        error: "Você só pode registrar uso de peça do seu próprio carrinho",
      });
    }

    const resultado = await registrarUsoDePecaInterno({
      manutencaoId: manutencao.id,
      pecaId,
      quantidade,
      funcionarioId: funcionarioAlvo,
      observacao,
      transaction,
    });

    if (resultado) {
      await transaction.rollback();
      return res.status(resultado.status).json({ error: resultado.error });
    }

    await transaction.commit();

    const manutencaoAtualizada = await Manutencao.findByPk(manutencao.id, {
      include: includeAdmin,
    });

    res.status(201).json(manutencaoAtualizada);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao registrar uso de peça na manutenção:", error);
    res
      .status(500)
      .json({ error: "Erro ao registrar uso de peça na manutenção" });
  }
};

export const listarPecasQuebradasManutencao = async (req, res) => {
  try {
    const manutencao = await Manutencao.findByPk(req.params.id);

    if (!manutencao) {
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }

    const pecasQuebradas = await ManutencaoPecaQuebrada.findAll({
      where: { manutencaoId: req.params.id },
      include: [
        { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
        { model: Usuario, as: "funcionario", attributes: ["id", "nome"] },
      ],
      order: [["dataDevolucao", "DESC"]],
    });

    res.json(pecasQuebradas);
  } catch (error) {
    console.error("Erro ao listar peças quebradas da manutenção:", error);
    res
      .status(500)
      .json({ error: "Erro ao listar peças quebradas da manutenção" });
  }
};

// Devolve peça quebrada removida/identificada durante a manutenção. Não
// mexe no carrinho do funcionário nem no estoque bom — só soma no saldo
// "quebrada" central da peça, separado, pra virar descarte/conserto/
// reposição depois.
export const registrarPecaQuebradaManutencao = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { pecaId, quantidade, observacao, funcionarioId } = req.body;
    const quantidadeNumerica = Number(quantidade);

    if (!pecaId) {
      await transaction.rollback();
      return res.status(400).json({ error: "Selecione a peça quebrada" });
    }

    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe uma quantidade válida (inteiro maior que zero)" });
    }

    const manutencao = await Manutencao.findByPk(req.params.id, {
      include: [
        {
          model: Usuario,
          as: "funcionariosPermitidos",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
      transaction,
    });

    if (!manutencao) {
      await transaction.rollback();
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }

    if (!usuarioPodeAgirNaManutencao(manutencao, req.usuario)) {
      await transaction.rollback();
      return res.status(403).json({
        error:
          "Você não tem permissão para registrar peça quebrada nesta manutenção",
      });
    }

    // Por padrão quem registra é quem devolveu; admin/dev/cadastro podem
    // registrar em nome de outro funcionário.
    const funcionarioAlvo = funcionarioId || req.usuario.id;
    if (
      funcionarioAlvo !== req.usuario.id &&
      !temAcao(req.usuario, "manutencao.registrarPorOutro")
    ) {
      await transaction.rollback();
      return res.status(403).json({
        error: "Você só pode registrar a devolução em seu próprio nome",
      });
    }

    const peca = await Peca.findByPk(pecaId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!peca) {
      await transaction.rollback();
      return res.status(400).json({ error: "Peça informada não encontrada" });
    }

    await peca.update(
      { quantidadeQuebrada: (peca.quantidadeQuebrada || 0) + quantidadeNumerica },
      { transaction },
    );

    await ManutencaoPecaQuebrada.create(
      {
        manutencaoId: manutencao.id,
        pecaId,
        quantidade: quantidadeNumerica,
        funcionarioId: funcionarioAlvo,
        observacao: observacao || null,
      },
      { transaction },
    );

    await transaction.commit();

    const manutencaoAtualizada = await Manutencao.findByPk(manutencao.id, {
      include: includeAdmin,
    });

    res.status(201).json(manutencaoAtualizada);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao registrar peça quebrada na manutenção:", error);
    res
      .status(500)
      .json({ error: "Erro ao registrar peça quebrada na manutenção" });
  }
};

export const obterHistoricoMaquina = async (req, res) => {
  try {
    const { maquinaId } = req.params;

    const maquina = await Maquina.findByPk(maquinaId, {
      attributes: ["id", "codigo", "nome"],
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    const manutencoes = await Manutencao.findAll({
      where: { maquinaId },
      include: [
        {
          model: Usuario,
          as: "criadoPor",
          attributes: ["id", "nome", "email"],
        },
        {
          model: Usuario,
          as: "responsavel",
          attributes: ["id", "nome", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const { recorrente, motivos } = await avaliarRecorrencia(maquinaId, null);

    res.json({
      maquina,
      manutencoes,
      recorrente,
      recorrenciaMotivos: motivos,
    });
  } catch (error) {
    console.error("Erro ao obter histórico de manutenção da máquina:", error);
    res
      .status(500)
      .json({ error: "Erro ao obter histórico de manutenção da máquina" });
  }
};
