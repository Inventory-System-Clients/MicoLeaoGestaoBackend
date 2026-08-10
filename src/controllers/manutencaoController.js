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

const STATUS_ABERTOS = ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"];
const STATUS_VALIDOS = [...STATUS_ABERTOS, "CONCLUIDA"];
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
  ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(usuario.role) ||
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
    } = req.body;

    if (!titulo || !descricao) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });
    }

    if (!Array.isArray(funcionariosIds) || funcionariosIds.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Selecione ao menos um funcionário" });
    }

    const idsUnicos = [...new Set(funcionariosIds.filter(Boolean))];

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

    const funcionarios = await Usuario.findAll({
      where: {
        id: { [Op.in]: idsUnicos },
        role: "FUNCIONARIO",
        ativo: true,
      },
      attributes: ["id"],
      transaction,
    });

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

export const listarManutencoes = async (req, res) => {
  try {
    const { status, dataInicio, dataFim, lojaId, maquinaId, tipoProblema, usuarioId } =
      req.query;
    let include = [...includeAdmin];
    const where = {};

    if (!["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(req.usuario.role)) {
      where.status = { [Op.ne]: "CONCLUIDA" };
      where[Op.or] = [
        { responsavelId: req.usuario.id },
        { "$funcionariosPermitidos.id$": req.usuario.id },
      ];
      include = [
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
        {
          model: Usuario,
          as: "funcionariosPermitidos",
          attributes: ["id", "nome", "email"],
          through: { attributes: [] },
          required: false,
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
            {
              model: Peca,
              as: "peca",
              attributes: ["id", "codigo", "nome", "unidade"],
            },
            { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
          ],
        },
      ];
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
      !["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(
        req.usuario.role,
      )
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
      !["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(
        req.usuario.role,
      )
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
