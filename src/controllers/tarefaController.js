import { Op } from "sequelize";
import {
  Tarefa,
  Usuario,
  Loja,
  Maquina,
  ContaPagar,
  ExtintorLoja,
} from "../models/index.js";
import { temAcao } from "../permissoes/acessos.js";
import {
  ACOES_TAREFA,
  TIPOS_TAREFA,
  erroTarefa,
  hojeBrasilia,
  podeUsarRota,
  tiposPermitidos,
} from "../services/tarefaAcoes.js";
import {
  DIAS_ANTECEDENCIA_EXTINTOR,
  DIAS_ANTECEDENCIA_CONTRATO_DEFAULT,
} from "./relatorioController.js";

// Tarefas (Análise > Tarefas). Cada um vê as que criou e as que são para ele;
// quem tem "tarefas.gerenciar" (Admin) vê todas, escolhe responsável das
// automáticas e pode marcar qualquer uma como feita.

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const ABERTAS = ["PENDENTE", "ACEITA", "RECUSADA"];
const USUARIO_ATTRS = ["id", "nome", "role"];

const incluir = [
  { model: Usuario, as: "criadoPor", attributes: USUARIO_ATTRS },
  { model: Usuario, as: "responsavel", attributes: USUARIO_ATTRS },
  { model: Usuario, as: "feitaPor", attributes: USUARIO_ATTRS },
  { model: Loja, as: "loja", attributes: ["id", "nome"] },
];

export const ehGestorDeTarefas = (usuario) => temAcao(usuario, "tarefas.gerenciar");

const responder = (res, error, padrao) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(`${padrao}:`, error);
  return res.status(500).json({ error: padrao });
};

const registro = (usuario, acao, detalhe) => ({
  em: new Date().toISOString(),
  porId: usuario?.id || null,
  porNome: usuario?.nome || "Sistema",
  acao,
  detalhe: detalhe || null,
});

const comHistorico = (tarefa, ...entradas) => [...(tarefa.historico || []), ...entradas];

// Prazo da tarefa: o último dia do período (ou o dia, se for de um dia só)
export const prazoDaTarefa = (tarefa) => tarefa.dataFim || tarefa.data;

// Tarefas que caem (ao menos um dia) entre inicio e fim
export const filtroPeriodoTarefa = (inicio, fim) => {
  const condicoes = [];
  if (fim) condicoes.push({ data: { [Op.lte]: fim } });
  if (inicio) {
    condicoes.push({
      [Op.or]: [
        { dataFim: { [Op.gte]: inicio } },
        { dataFim: null, data: { [Op.gte]: inicio } },
      ],
    });
  }
  return condicoes;
};

const lerDataFim = (data, dataFim) => {
  if (!dataFim || dataFim === data) return null;
  if (!DATA_VALIDA.test(dataFim)) throw erroTarefa(400, "Escolha o último dia da tarefa.");
  if (dataFim < data) throw erroTarefa(400, "O último dia não pode ser antes do primeiro.");
  return dataFim;
};

const textoDias = (data, dataFim) => (dataFim ? `${dataBr(data)} a ${dataBr(dataFim)}` : dataBr(data));

const formatar = (tarefa, usuario) => {
  const json = tarefa.toJSON();
  const gestor = ehGestorDeTarefas(usuario);
  const souResponsavel = json.responsavelId === usuario.id;
  const souCriador = json.criadoPorId === usuario.id;
  const semResponsavel = !json.responsavelId;
  const acao = ACOES_TAREFA[json.tipo] || ACOES_TAREFA.LIVRE;
  return {
    ...json,
    codigo: tarefa.codigo,
    tipoNome: acao.nome,
    pedeNoFeito: acao.pedeNoFeito || null,
    atrasada: ABERTAS.includes(json.status) && prazoDaTarefa(json) < hojeBrasilia(),
    pode: {
      // Sem responsável: quem criou (ou o admin) pega para si
      aceitar: json.status === "PENDENTE" && (souResponsavel || (semResponsavel && (gestor || souCriador))),
      recusar: ["PENDENTE", "ACEITA"].includes(json.status) && souResponsavel,
      feito:
        (json.status === "ACEITA" && souResponsavel) ||
        (semResponsavel && souCriador && json.status === "PENDENTE") ||
        (gestor && ["PENDENTE", "ACEITA", "RECUSADA"].includes(json.status)),
      editar: ABERTAS.includes(json.status) && (souCriador || gestor),
      cancelar: ABERTAS.includes(json.status) && (souCriador || gestor),
    },
  };
};

const buscarResponsavel = async (responsavelId) => {
  if (!responsavelId) return null;
  const usuario = await Usuario.findByPk(responsavelId, { attributes: ["id", "nome", "ativo"] });
  if (!usuario || !usuario.ativo) throw erroTarefa(400, "Escolha um responsável ativo.");
  return usuario;
};

const carregarTarefa = async (id) => {
  const tarefa = await Tarefa.findByPk(id, { include: incluir });
  if (!tarefa) throw erroTarefa(404, "Tarefa não encontrada.");
  return tarefa;
};

// ---------------------------------------------------------------------------
// Tarefas automáticas: extintor e contrato vencendo viram tarefa, no mesmo
// prazo do alerta (extintor: DIAS_ANTECEDENCIA_EXTINTOR; contrato: os dias de
// aviso da loja). Aparecem no calendário no dia do vencimento, sem
// responsável: o admin escolhe quem faz. Se a data mudar no cadastro (ou o
// extintor sair), a tarefa aberta é cancelada e nasce outra se precisar.
// ---------------------------------------------------------------------------
const somarDias = (data, dias) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const dataBr = (data) => String(data).slice(0, 10).split("-").reverse().join("/");

let ultimaSincronizacao = 0;

export const sincronizarTarefasAutomaticas = async ({ forcar = false } = {}) => {
  if (!forcar && Date.now() - ultimaSincronizacao < 5 * 60 * 1000) return;
  ultimaSincronizacao = Date.now();
  const hoje = hojeBrasilia();

  try {
    const desejadas = new Map(); // origem -> dados da tarefa

    const extintores = await ExtintorLoja.findAll({
      include: [{ model: Loja, as: "loja", where: { ativo: true }, attributes: ["id", "nome"] }],
    });
    const limiteExtintor = somarDias(hoje, DIAS_ANTECEDENCIA_EXTINTOR);
    for (const extintor of extintores) {
      if (extintor.dataVencimento > limiteExtintor) continue;
      const nome = extintor.identificacao || extintor.numero;
      desejadas.set(`EXTINTOR:${extintor.id}:${extintor.dataVencimento}`, {
        tipo: "TROCAR_EXTINTOR",
        titulo: `Trocar extintor${nome ? ` (${nome})` : ""} · ${extintor.loja.nome} · vence ${dataBr(extintor.dataVencimento)}`,
        data: extintor.dataVencimento,
        lojaId: extintor.lojaId,
        dados: { extintorId: extintor.id },
      });
    }

    const lojas = await Loja.findAll({
      where: { ativo: true, dataFimContrato: { [Op.ne]: null } },
      attributes: ["id", "nome", "dataFimContrato", "diasAvisoContrato", "contratoAvisoAdiadoDias"],
    });
    for (const loja of lojas) {
      const diasAviso =
        loja.contratoAvisoAdiadoDias ?? loja.diasAvisoContrato ?? DIAS_ANTECEDENCIA_CONTRATO_DEFAULT;
      if (loja.dataFimContrato > somarDias(hoje, diasAviso)) continue;
      desejadas.set(`CONTRATO:${loja.id}:${loja.dataFimContrato}`, {
        tipo: "RENOVAR_CONTRATO",
        titulo: `Renovar contrato · ${loja.nome} · vence ${dataBr(loja.dataFimContrato)}`,
        data: loja.dataFimContrato,
        lojaId: loja.id,
        dados: { lojaId: loja.id },
      });
    }

    const existentes = await Tarefa.findAll({
      where: { automatica: true, origem: { [Op.ne]: null } },
      attributes: ["id", "origem", "status", "tipo", "dados", "historico"],
    });
    const origensExistentes = new Set(existentes.map((tarefa) => tarefa.origem));

    // Data mudou no cadastro (ou extintor saiu): cancela a tarefa aberta antiga
    const vigentes = new Set();
    for (const extintor of extintores) vigentes.add(`EXTINTOR:${extintor.id}:${extintor.dataVencimento}`);
    for (const loja of lojas) vigentes.add(`CONTRATO:${loja.id}:${loja.dataFimContrato}`);
    for (const tarefa of existentes) {
      if (!ABERTAS.includes(tarefa.status) || vigentes.has(tarefa.origem)) continue;
      await tarefa.update({
        status: "CANCELADA",
        historico: comHistorico(tarefa, registro(null, "CANCELADA", "A data mudou no cadastro (ou o item saiu)")),
      });
    }

    for (const [origem, dados] of desejadas) {
      if (origensExistentes.has(origem)) continue;
      await Tarefa.create({
        ...dados,
        origem,
        automatica: true,
        status: "PENDENTE",
        historico: [registro(null, "CRIADA", "Criada pelo sistema (alerta de vencimento)")],
      });
    }
  } catch (error) {
    ultimaSincronizacao = 0;
    console.error("Erro ao criar tarefas automáticas:", error);
  }
};

export const agendarTarefasAutomaticas = () => {
  sincronizarTarefasAutomaticas({ forcar: true });
  setInterval(() => sincronizarTarefasAutomaticas({ forcar: true }), 60 * 60 * 1000);
};

// ---------------------------------------------------------------------------

const tarefaController = {
  // ?escopo=minhas|criadas|todas  &status=  &inicio=&fim=
  async listar(req, res) {
    try {
      await sincronizarTarefasAutomaticas();
      const usuario = req.usuario;
      const gestor = ehGestorDeTarefas(usuario);
      const { escopo, status, inicio, fim } = req.query;
      const where = {};

      if (escopo === "minhas") where.responsavelId = usuario.id;
      else if (escopo === "criadas") where.criadoPorId = usuario.id;
      else if (!(escopo === "todas" && gestor)) {
        where[Op.or] = [{ responsavelId: usuario.id }, { criadoPorId: usuario.id }];
      }
      if (status === "abertas") where.status = { [Op.in]: ABERTAS };
      else if (status) where.status = status;
      const periodo = filtroPeriodoTarefa(
        DATA_VALIDA.test(inicio || "") ? inicio : null,
        DATA_VALIDA.test(fim || "") ? fim : null,
      );
      if (periodo.length) where[Op.and] = periodo;

      const tarefas = await Tarefa.findAll({
        where,
        include: incluir,
        order: [["data", "ASC"], ["id", "ASC"]],
        limit: 1000,
      });
      res.json({ gestor, tarefas: tarefas.map((tarefa) => formatar(tarefa, usuario)) });
    } catch (error) {
      responder(res, error, "Erro ao listar tarefas");
    }
  },

  // Quem pode ser responsável e o que dá para agendar
  async opcoes(req, res) {
    try {
      const usuario = req.usuario;
      const tipos = tiposPermitidos(usuario);
      const precisaMaquinas = tipos.some((tipo) => ["TRANSFERIR_MAQUINA", "STATUS_MAQUINA", "PRECO_MAQUINA"].includes(tipo));

      const [usuarios, lojas, maquinas, contas, extintores] = await Promise.all([
        Usuario.findAll({ where: { ativo: true }, attributes: USUARIO_ATTRS, order: [["nome", "ASC"]] }),
        Loja.findAll({ where: { ativo: true }, attributes: ["id", "nome", "dataFimContrato"], order: [["nome", "ASC"]] }),
        precisaMaquinas
          ? Maquina.findAll({
              where: { ativo: true },
              attributes: ["id", "codigo", "nome", "lojaId", "statusOperacao", "categoriaGeradora", "valorFicha", "valorJogada"],
              order: [["codigo", "ASC"]],
            })
          : [],
        tipos.includes("PAGAR_CONTA")
          ? ContaPagar.findAll({
              where: { status: "PENDENTE" },
              attributes: ["id", "descricao", "valor", "valorBrl", "vencimento", "numeroParcela", "totalParcelas"],
              order: [["vencimento", "ASC"]],
              limit: 300,
            })
          : [],
        tipos.includes("TROCAR_EXTINTOR")
          ? ExtintorLoja.findAll({
              attributes: ["id", "lojaId", "identificacao", "numero", "dataVencimento"],
              order: [["dataVencimento", "ASC"]],
            })
          : [],
      ]);

      res.json({
        gestor: ehGestorDeTarefas(usuario),
        tipos: tipos.map((tipo) => ({
          tipo,
          nome: ACOES_TAREFA[tipo].nome,
          pedeNoFeito: ACOES_TAREFA[tipo].pedeNoFeito || null,
        })),
        usuarios,
        lojas,
        maquinas,
        contas,
        extintores,
      });
    } catch (error) {
      responder(res, error, "Erro ao carregar opções das tarefas");
    }
  },

  async criar(req, res) {
    try {
      const usuario = req.usuario;
      const { titulo, descricao, tipo = "LIVRE", dados = {}, data, dataFim, responsavelId } = req.body;

      if (!TIPOS_TAREFA.includes(tipo)) throw erroTarefa(400, "Tipo de tarefa inválido.");
      if (!DATA_VALIDA.test(data || "")) throw erroTarefa(400, "Escolha o dia da tarefa.");
      const ultimoDia = lerDataFim(data, dataFim);
      const acao = ACOES_TAREFA[tipo];
      if (acao.rota && !podeUsarRota(usuario, acao.rota)) {
        throw erroTarefa(403, `Você não tem acesso para agendar "${acao.nome}".`);
      }
      // Vazio = não é para alguém em especial
      const responsavel = await buscarResponsavel(responsavelId);

      const preparada = await acao.preparar(dados || {});
      const tituloFinal = String(titulo || "").trim() || preparada.titulo;
      if (!tituloFinal) throw erroTarefa(400, "Escreva o que precisa ser feito.");

      // Tarefa para si mesmo já nasce aceita
      const paraMim = responsavel?.id === usuario.id;
      const historico = [
        registro(
          usuario,
          "CRIADA",
          `${responsavel ? `Para ${responsavel.nome}` : "Sem responsável"} · ${textoDias(data, ultimoDia)}`,
        ),
        ...(paraMim ? [registro(usuario, "ACEITA")] : []),
      ];

      const tarefa = await Tarefa.create({
        titulo: tituloFinal.slice(0, 200),
        descricao: String(descricao || "").trim() || null,
        tipo,
        dados: preparada.dados,
        data,
        dataFim: ultimoDia,
        lojaId: preparada.lojaId,
        criadoPorId: usuario.id,
        responsavelId: responsavel?.id || null,
        status: paraMim ? "ACEITA" : "PENDENTE",
        aceitaEm: paraMim ? new Date() : null,
        historico,
      });
      res.status(201).json(formatar(await carregarTarefa(tarefa.id), usuario));
    } catch (error) {
      responder(res, error, "Erro ao criar tarefa");
    }
  },

  // Muda título, descrição, dia ou responsável (a ação não muda: cancele e crie outra)
  async editar(req, res) {
    try {
      const usuario = req.usuario;
      const tarefa = await carregarTarefa(req.params.id);
      if (!formatar(tarefa, usuario).pode.editar) throw erroTarefa(403, "Você não pode editar esta tarefa.");

      const { titulo, descricao, data, dataFim, responsavelId } = req.body;
      const mudancas = {};
      const detalhes = [];

      if (titulo !== undefined) {
        const novo = String(titulo || "").trim();
        if (!novo) throw erroTarefa(400, "Escreva o que precisa ser feito.");
        mudancas.titulo = novo.slice(0, 200);
      }
      if (descricao !== undefined) mudancas.descricao = String(descricao || "").trim() || null;
      if (data !== undefined || dataFim !== undefined) {
        const novoInicio = data !== undefined ? data : tarefa.data;
        if (!DATA_VALIDA.test(novoInicio || "")) throw erroTarefa(400, "Escolha o dia da tarefa.");
        const novoFim = lerDataFim(novoInicio, dataFim !== undefined ? dataFim : tarefa.dataFim);
        if (novoInicio !== tarefa.data || (novoFim || null) !== (tarefa.dataFim || null)) {
          mudancas.data = novoInicio;
          mudancas.dataFim = novoFim;
          detalhes.push(`dia ${textoDias(tarefa.data, tarefa.dataFim)} → ${textoDias(novoInicio, novoFim)}`);
        }
      }
      const novoResponsavelId = responsavelId === undefined ? undefined : responsavelId || null;
      if (novoResponsavelId !== undefined && novoResponsavelId !== (tarefa.responsavelId || null)) {
        const responsavel = await buscarResponsavel(novoResponsavelId);
        const paraMim = responsavel?.id === usuario.id;
        Object.assign(mudancas, {
          responsavelId: responsavel?.id || null,
          status: paraMim ? "ACEITA" : "PENDENTE",
          aceitaEm: paraMim ? new Date() : null,
          motivoRecusa: null,
        });
        detalhes.push(responsavel ? `agora é para ${responsavel.nome}` : "agora sem responsável");
      }

      if (Object.keys(mudancas).length === 0) return res.json(formatar(tarefa, usuario));
      mudancas.historico = comHistorico(tarefa, registro(usuario, "EDITADA", detalhes.join("; ") || null));
      await tarefa.update(mudancas);
      res.json(formatar(await carregarTarefa(tarefa.id), usuario));
    } catch (error) {
      responder(res, error, "Erro ao editar tarefa");
    }
  },

  async aceitar(req, res) {
    try {
      const usuario = req.usuario;
      const tarefa = await carregarTarefa(req.params.id);
      if (!formatar(tarefa, usuario).pode.aceitar) throw erroTarefa(403, "Você não pode aceitar esta tarefa.");
      await tarefa.update({
        status: "ACEITA",
        aceitaEm: new Date(),
        responsavelId: tarefa.responsavelId || usuario.id,
        historico: comHistorico(tarefa, registro(usuario, "ACEITA")),
      });
      res.json(formatar(await carregarTarefa(tarefa.id), usuario));
    } catch (error) {
      responder(res, error, "Erro ao aceitar tarefa");
    }
  },

  async recusar(req, res) {
    try {
      const usuario = req.usuario;
      const tarefa = await carregarTarefa(req.params.id);
      if (!formatar(tarefa, usuario).pode.recusar) throw erroTarefa(403, "Você não pode recusar esta tarefa.");
      const motivo = String(req.body?.motivo || "").trim();
      if (!motivo) throw erroTarefa(400, "Diga por que está recusando.");
      await tarefa.update({
        status: "RECUSADA",
        motivoRecusa: motivo,
        historico: comHistorico(tarefa, registro(usuario, "RECUSADA", motivo)),
      });
      res.json(formatar(await carregarTarefa(tarefa.id), usuario));
    } catch (error) {
      responder(res, error, "Erro ao recusar tarefa");
    }
  },

  // "Feito": faz a ação da tarefa (se tiver) e marca como feita
  async feito(req, res) {
    try {
      const usuario = req.usuario;
      const tarefa = await carregarTarefa(req.params.id);
      if (!formatar(tarefa, usuario).pode.feito) throw erroTarefa(403, "Você não pode marcar esta tarefa como feita.");
      const acao = ACOES_TAREFA[tarefa.tipo] || ACOES_TAREFA.LIVRE;

      // A ação roda com a autorização de quem agendou (ou do admin que fez)
      if (acao.rota && tarefa.criadoPorId && !podeUsarRota(usuario, acao.rota)) {
        const criador = await Usuario.findByPk(tarefa.criadoPorId);
        if (!podeUsarRota(criador, acao.rota)) {
          throw erroTarefa(403, `Quem agendou não tem mais acesso a "${acao.nome}". Fale com o administrador.`);
        }
      }

      // Trava contra dois cliques (ou duas pessoas) fazendo a ação duas vezes
      const statusAnterior = tarefa.status;
      const [travou] = await Tarefa.update(
        { status: "EXECUTANDO" },
        { where: { id: tarefa.id, status: statusAnterior } },
      );
      if (!travou) throw erroTarefa(409, "Essa tarefa acabou de mudar. Atualize a página.");

      let resultado;
      try {
        resultado = await acao.executar(tarefa, { executor: usuario, corpo: req.body || {} });
      } catch (error) {
        await Tarefa.update({ status: statusAnterior }, { where: { id: tarefa.id } });
        throw error;
      }

      const observacao = String(req.body?.observacao || "").trim();
      await tarefa.update({
        status: "FEITA",
        feitaEm: new Date(),
        feitaPorId: usuario.id,
        responsavelId: tarefa.responsavelId || usuario.id,
        aceitaEm: tarefa.aceitaEm || new Date(),
        resultado: resultado ? { ...resultado, observacao: observacao || undefined } : observacao ? { observacao } : null,
        historico: comHistorico(
          tarefa,
          registro(usuario, "FEITA", [resultado?.mensagem, observacao].filter(Boolean).join(" · ") || null),
        ),
      });
      res.json(formatar(await carregarTarefa(tarefa.id), usuario));
    } catch (error) {
      responder(res, error, "Erro ao marcar tarefa como feita");
    }
  },

  async cancelar(req, res) {
    try {
      const usuario = req.usuario;
      const tarefa = await carregarTarefa(req.params.id);
      if (!formatar(tarefa, usuario).pode.cancelar) throw erroTarefa(403, "Você não pode cancelar esta tarefa.");
      const motivo = String(req.body?.motivo || "").trim();
      await tarefa.update({
        status: "CANCELADA",
        historico: comHistorico(tarefa, registro(usuario, "CANCELADA", motivo || null)),
      });
      res.json(formatar(await carregarTarefa(tarefa.id), usuario));
    } catch (error) {
      responder(res, error, "Erro ao cancelar tarefa");
    }
  },

  // Relatório (Relatórios): tarefas com dia no período
  async relatorio(req, res) {
    try {
      const { dataInicio, dataFim, lojaId } = req.query;
      if (!DATA_VALIDA.test(dataInicio || "") || !DATA_VALIDA.test(dataFim || "")) {
        throw erroTarefa(400, "Informe o período.");
      }
      const where = { [Op.and]: filtroPeriodoTarefa(dataInicio, dataFim) };
      if (lojaId && lojaId !== "todas") where.lojaId = lojaId;

      const tarefas = (
        await Tarefa.findAll({ where, include: incluir, order: [["data", "ASC"], ["id", "ASC"]] })
      ).map((tarefa) => formatar(tarefa, req.usuario));

      const contar = (lista) => ({
        total: lista.length,
        feitas: lista.filter((t) => t.status === "FEITA").length,
        noPrazo: lista.filter((t) => t.status === "FEITA" && t.feitaEm && new Date(t.feitaEm).toISOString().slice(0, 10) <= prazoDaTarefa(t)).length,
        abertas: lista.filter((t) => ABERTAS.includes(t.status)).length,
        atrasadas: lista.filter((t) => t.atrasada).length,
        recusadas: lista.filter((t) => t.status === "RECUSADA").length,
        canceladas: lista.filter((t) => t.status === "CANCELADA").length,
      });

      const porPessoa = new Map();
      for (const tarefa of tarefas) {
        const chave = tarefa.responsavel?.id || "sem";
        if (!porPessoa.has(chave)) porPessoa.set(chave, { nome: tarefa.responsavel?.nome || "Sem responsável", tarefas: [] });
        porPessoa.get(chave).tarefas.push(tarefa);
      }

      res.json({
        totais: contar(tarefas),
        porResponsavel: [...porPessoa.values()]
          .map(({ nome, tarefas: lista }) => ({ nome, ...contar(lista) }))
          .sort((a, b) => b.total - a.total),
        tarefas,
      });
    } catch (error) {
      responder(res, error, "Erro ao gerar relatório de tarefas");
    }
  },
};

export default tarefaController;
