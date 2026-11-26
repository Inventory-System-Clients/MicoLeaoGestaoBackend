import { Op } from "sequelize";
import {
  Tarefa,
  PeriodoCalendario,
  ContaPagar,
  ExtintorLoja,
  Loja,
  Manutencao,
  Maquina,
  Roteiro,
  Usuario,
  ProjetoLoja,
  TransferenciaMaquina,
  GastoVariavel,
  Compra,
  Fornecedor,
} from "../models/index.js";
import { sincronizarTarefasAutomaticas, filtroPeriodoTarefa, prazoDaTarefa, nomesDasPessoas } from "./tarefaController.js";
import { hojeBrasilia } from "../services/tarefaAcoes.js";

// Calendário (Análise > Calendário, admin): junta tudo o que tem data no
// sistema num formato só de evento:
//   { id, categoria, titulo, detalhe, data, dataFim, status, link, tarefaId }
// Tarefas e períodos são daqui; o resto vem de cada área (só leitura, o
// clique leva para a tela de origem).

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Data/hora gravada (timestamp) -> dia em Brasília
const diaBrasilia = (valor) =>
  valor ? new Date(new Date(valor).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
const inicioDoDia = (dia) => new Date(`${dia}T00:00:00.000-03:00`);
const fimDoDia = (dia) => new Date(`${dia}T23:59:59.999-03:00`);
const CORES_PERIODO = ["vermelho", "verde", "azul", "amarelo", "roxo", "laranja", "rosa"];

const responder = (res, error, padrao) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(`${padrao}:`, error);
  return res.status(500).json({ error: padrao });
};

const lerIntervalo = (query) => {
  const { inicio, fim } = query;
  if (!DATA_VALIDA.test(inicio || "") || !DATA_VALIDA.test(fim || "") || inicio > fim) {
    throw Object.assign(new Error("Informe o período (inicio e fim)."), { status: 400 });
  }
  const dias = (new Date(fim) - new Date(inicio)) / 86400000;
  if (dias > 120) throw Object.assign(new Error("Período máximo: 120 dias."), { status: 400 });
  return { inicio, fim };
};

const STATUS_TAREFA = {
  PENDENTE: "Esperando aceite",
  ACEITA: "Aceita",
  EXECUTANDO: "Fazendo",
  FEITA: "Feita",
  RECUSADA: "Recusada",
  CANCELADA: "Cancelada",
};

// Hora em Brasília (HH:MM)
const horaBrasilia = (valor) => new Date(new Date(valor).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(11, 16);
const faixa = (de, ate) => {
  const mesmoDia = diaBrasilia(de) === diaBrasilia(ate);
  return mesmoDia ? `${horaBrasilia(de)}–${horaBrasilia(ate)}` : `${horaBrasilia(de)} até ${diaBrasilia(ate).split("-").reverse().join("/")} ${horaBrasilia(ate)}`;
};
const STATUS_ROTA = { AGENDADA: "Agendada", EM_ANDAMENTO: "Em andamento", FINALIZADA: "Finalizada" };

// Eventos da rota no calendário: a rota (início → fim real ou previsto) e cada
// período que alguém da rota disse que vai fazer; só os que caem no intervalo
const eventosDaRota = (rota, inicio, fim) => {
  const dentro = (de, ate) => diaBrasilia(de) <= fim && diaBrasilia(ate || de) >= inicio;
  // Começou (antes ou depois do marcado): vale o começo real
  const de = rota.status !== "AGENDADA" && rota.iniciadaEm ? rota.iniciadaEm : rota.dataInicio;
  const ate = rota.dataFim || (rota.previsaoFim && new Date(rota.previsaoFim) > new Date(de) ? rota.previsaoFim : null);
  const eventos = [];
  if (dentro(de, ate)) {
    eventos.push({
      id: `rota-${rota.id}`,
      categoria: "rota",
      titulo: `${rota.nome} · ${ate ? faixa(de, ate) : horaBrasilia(de)}${!rota.dataFim && ate ? " (previsto)" : ""}`,
      detalhe: [rota.funcionario?.nome, STATUS_ROTA[rota.status] || rota.status].filter(Boolean).join(" · ") || null,
      data: diaBrasilia(de),
      dataFim: ate && diaBrasilia(ate) !== diaBrasilia(de) ? diaBrasilia(ate) : null,
      status: rota.status,
      link: "/roteiros",
    });
  }
  for (const periodo of rota.periodos || []) {
    if (!dentro(periodo.inicio, periodo.fim)) continue;
    eventos.push({
      id: `rota-periodo-${periodo.id}`,
      categoria: "rota",
      titulo: `${rota.nome} · período ${faixa(periodo.inicio, periodo.fim)}`,
      detalhe: [periodo.usuarioNome, periodo.observacao].filter(Boolean).join(" · ") || null,
      data: diaBrasilia(periodo.inicio),
      dataFim: diaBrasilia(periodo.fim) !== diaBrasilia(periodo.inicio) ? diaBrasilia(periodo.fim) : null,
      status: rota.status,
      link: "/roteiros",
    });
  }
  return eventos;
};

const calendarioController = {
  async listar(req, res) {
    try {
      const { inicio, fim } = lerIntervalo(req.query);
      await sincronizarTarefasAutomaticas();
      const hoje = hojeBrasilia();
      const entre = { [Op.between]: [inicio, fim] };

      const [
        tarefas,
        periodos,
        contas,
        extintores,
        lojasContrato,
        lojasInicio,
        manutencoes,
        rotas,
        projetos,
        transferencias,
        gastos,
        compras,
      ] = await Promise.all([
        Tarefa.findAll({
          where: { [Op.and]: filtroPeriodoTarefa(inicio, fim), status: { [Op.ne]: "CANCELADA" } },
          include: [
            { model: Usuario, as: "responsavel", attributes: ["id", "nome"] },
            { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
          ],
        }),
        PeriodoCalendario.findAll({
          where: { dataInicio: { [Op.lte]: fim }, dataFim: { [Op.gte]: inicio } },
        }),
        ContaPagar.findAll({
          where: { vencimento: entre },
          attributes: ["id", "descricao", "valor", "valorBrl", "vencimento", "status", "numeroParcela", "totalParcelas"],
        }),
        ExtintorLoja.findAll({
          where: { dataVencimento: entre },
          include: [{ model: Loja, as: "loja", where: { ativo: true }, attributes: ["id", "nome"] }],
        }),
        Loja.findAll({ where: { ativo: true, dataFimContrato: entre }, attributes: ["id", "nome", "dataFimContrato"] }),
        Loja.findAll({ where: { ativo: true, dataInicio: entre }, attributes: ["id", "nome", "dataInicio"] }),
        Manutencao.findAll({
          where: { prazo: entre, status: { [Op.notIn]: ["FINALIZADA", "RECUSADA"] } },
          attributes: ["id", "titulo", "prazo", "status"],
          include: [
            { model: Loja, as: "loja", attributes: ["id", "nome"] },
            { model: Maquina, as: "maquina", attributes: ["id", "codigo"] },
          ],
        }),
        // Rota: do início ao fim (real ou previsto) e os períodos que as
        // pessoas disseram que vão fazer
        Roteiro.findAll({
          where: {
            ativo: true,
            dataInicio: { [Op.ne]: null, [Op.lte]: fimDoDia(fim) },
            [Op.or]: [
              { dataInicio: { [Op.gte]: inicioDoDia(inicio) } },
              { dataFim: { [Op.gte]: inicioDoDia(inicio) } },
              { previsaoFim: { [Op.gte]: inicioDoDia(inicio) } },
              { status: { [Op.ne]: "FINALIZADA" }, dataFim: null },
            ],
          },
          attributes: ["id", "nome", "dataInicio", "iniciadaEm", "dataFim", "previsaoFim", "status", "periodos"],
          include: [{ model: Usuario, as: "funcionario", attributes: ["id", "nome"] }],
        }),
        ProjetoLoja.findAll({
          where: { dataPrevisaoAbertura: entre, status: { [Op.ne]: "CANCELADO" } },
          attributes: ["id", "nome", "dataPrevisaoAbertura", "status"],
        }),
        TransferenciaMaquina.findAll({
          where: { dataTransferencia: entre },
          include: [
            { model: Maquina, as: "maquina", attributes: ["id", "codigo"] },
            { model: Loja, as: "lojaOrigem", attributes: ["id", "nome"] },
            { model: Loja, as: "lojaDestino", attributes: ["id", "nome"] },
          ],
        }),
        GastoVariavel.findAll({
          where: { dataInicio: { [Op.lte]: fimDoDia(fim) }, dataFim: { [Op.gte]: inicioDoDia(inicio) } },
          attributes: ["id", "nome", "valor", "dataInicio", "dataFim", "lojaId"],
        }),
        Compra.findAll({
          where: { dataCompra: entre },
          attributes: ["id", "numeroPedido", "dataCompra", "status"],
          include: [{ model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] }],
        }),
      ]);

      const nomesPessoas = await nomesDasPessoas(tarefas);
      const paraQuem = (tarefa) => {
        const ids = [...new Set([tarefa.responsavelId, ...(tarefa.pessoasIds || [])].filter(Boolean).map(String))];
        const nomes = ids.map((id) => nomesPessoas.get(id)?.nome).filter(Boolean);
        return nomes.length ? `Para ${nomes.join(", ")}` : "Sem responsável";
      };

      // Extintor e contrato que já viraram tarefa aparecem só como tarefa
      const origens = new Set(tarefas.map((tarefa) => tarefa.origem).filter(Boolean));

      const eventos = [
        ...tarefas.map((tarefa) => ({
          id: `tarefa-${tarefa.id}`,
          categoria: "tarefa",
          titulo: `${tarefa.codigo} · ${tarefa.titulo}`,
          detalhe: `${paraQuem(tarefa)} · ${STATUS_TAREFA[tarefa.status] || tarefa.status}`,
          data: tarefa.data,
          dataFim: tarefa.dataFim || undefined,
          status: tarefa.status,
          atrasada: ["PENDENTE", "ACEITA", "RECUSADA"].includes(tarefa.status) && prazoDaTarefa(tarefa) < hoje,
          tarefaId: tarefa.id,
          link: "/tarefas",
        })),
        ...periodos.map((periodo) => ({
          id: `periodo-${periodo.id}`,
          categoria: "periodo",
          titulo: periodo.feriado ? `🎉 Feriado: ${periodo.titulo}` : periodo.titulo,
          detalhe: periodo.descricao,
          data: periodo.dataInicio,
          dataFim: periodo.dataFim,
          cor: periodo.cor,
          periodoId: periodo.id,
          feriado: Boolean(periodo.feriado),
          nomePeriodo: periodo.titulo,
        })),
        ...contas.map((conta) => ({
          id: `conta-${conta.id}`,
          categoria: "conta",
          titulo: `Vence: ${conta.descricao}${conta.totalParcelas > 1 ? ` (${conta.numeroParcela}/${conta.totalParcelas})` : ""}`,
          detalhe: `${reais(conta.valorBrl ?? conta.valor)} · ${conta.status === "PAGA" ? "paga" : "a pagar"}`,
          data: conta.vencimento,
          status: conta.status,
          atrasada: conta.status === "PENDENTE" && conta.vencimento < hoje,
          contaPagarId: conta.id,
          link: "/contas-a-pagar",
        })),
        ...extintores
          .filter((extintor) => !origens.has(`EXTINTOR:${extintor.id}:${extintor.dataVencimento}`))
          .map((extintor) => ({
            id: `extintor-${extintor.id}`,
            categoria: "extintor",
            titulo: `Extintor vence · ${extintor.loja.nome}`,
            detalhe: extintor.identificacao || extintor.numero || null,
            data: extintor.dataVencimento,
            extintorId: extintor.id,
            link: `/lojas/${extintor.lojaId}`,
          })),
        ...lojasContrato
          .filter((loja) => !origens.has(`CONTRATO:${loja.id}:${loja.dataFimContrato}`))
          .map((loja) => ({
            id: `contrato-${loja.id}`,
            categoria: "contrato",
            titulo: `Fim do contrato · ${loja.nome}`,
            data: loja.dataFimContrato,
            lojaId: loja.id,
            link: `/lojas/${loja.id}`,
          })),
        ...lojasInicio.map((loja) => ({
          id: `inicio-loja-${loja.id}`,
          categoria: "loja",
          titulo: `Início da loja · ${loja.nome}`,
          data: loja.dataInicio,
          link: `/lojas/${loja.id}`,
        })),
        ...manutencoes.map((manutencao) => ({
          id: `manutencao-${manutencao.id}`,
          categoria: "manutencao",
          titulo: `Prazo manutenção: ${manutencao.titulo}`,
          detalhe: [manutencao.maquina?.codigo, manutencao.loja?.nome].filter(Boolean).join(" · ") || null,
          data: manutencao.prazo,
          status: manutencao.status,
          atrasada: manutencao.prazo < hoje && manutencao.status !== "CONCLUIDA",
          link: "/manutencao",
        })),
        ...rotas.flatMap((rota) => eventosDaRota(rota, inicio, fim)),
        ...projetos.map((projeto) => ({
          id: `projeto-${projeto.id}`,
          categoria: "projeto",
          titulo: `Abertura prevista: ${projeto.nome}`,
          data: projeto.dataPrevisaoAbertura,
          status: projeto.status,
          link: `/projetos-loja/${projeto.id}/editar`,
        })),
        ...transferencias.map((transferencia) => ({
          id: `transferencia-${transferencia.id}`,
          categoria: "transferencia",
          titulo: `Máquina ${transferencia.maquina?.codigo || ""} transferida`,
          detalhe: `${transferencia.lojaOrigem?.nome || "Depósito"} → ${transferencia.lojaDestino?.nome || "Depósito"}`,
          data: transferencia.dataTransferencia,
          link: "/relatorios/transferencias-maquinas",
        })),
        ...gastos.map((gasto) => ({
          id: `gasto-${gasto.id}`,
          categoria: "gasto",
          titulo: `Gasto: ${gasto.nome}`,
          detalhe: reais(gasto.valor),
          data: diaBrasilia(gasto.dataInicio),
          dataFim: diaBrasilia(gasto.dataFim),
          link: "/gastos-variaveis",
        })),
        ...compras.map((compra) => ({
          id: `compra-${compra.id}`,
          categoria: "compra",
          titulo: `Compra${compra.numeroPedido ? ` ${compra.numeroPedido}` : ""}${compra.fornecedor ? ` · ${compra.fornecedor.nome}` : ""}`,
          data: compra.dataCompra,
          status: compra.status,
          link: "/compras",
        })),
      ].filter((evento) => evento.data);

      res.json({ inicio, fim, hoje, eventos });
    } catch (error) {
      responder(res, error, "Erro ao carregar o calendário");
    }
  },

  async salvarPeriodo(req, res) {
    try {
      const { titulo, descricao, dataInicio, dataFim, cor, feriado } = req.body;
      const nome = String(titulo || "").trim();
      if (!nome) throw Object.assign(new Error("Dê um nome ao período (ex.: Natal)."), { status: 400 });
      if (!DATA_VALIDA.test(dataInicio || "") || !DATA_VALIDA.test(dataFim || "")) {
        throw Object.assign(new Error("Informe o início e o fim do período."), { status: 400 });
      }
      if (dataFim < dataInicio) throw Object.assign(new Error("O fim tem que ser depois do início."), { status: 400 });
      const dados = {
        titulo: nome.slice(0, 120),
        descricao: String(descricao || "").trim() || null,
        dataInicio,
        dataFim,
        cor: CORES_PERIODO.includes(cor) ? cor : "vermelho",
        feriado: Boolean(feriado),
      };

      let periodo;
      if (req.params.id) {
        periodo = await PeriodoCalendario.findByPk(req.params.id);
        if (!periodo) throw Object.assign(new Error("Período não encontrado."), { status: 404 });
        await periodo.update(dados);
      } else {
        periodo = await PeriodoCalendario.create({ ...dados, criadoPorId: req.usuario.id });
      }
      res.status(req.params.id ? 200 : 201).json(periodo);
    } catch (error) {
      responder(res, error, "Erro ao salvar o período");
    }
  },

  async excluirPeriodo(req, res) {
    try {
      const apagados = await PeriodoCalendario.destroy({ where: { id: req.params.id } });
      if (!apagados) throw Object.assign(new Error("Período não encontrado."), { status: 404 });
      res.json({ ok: true });
    } catch (error) {
      responder(res, error, "Erro ao excluir o período");
    }
  },
};

export default calendarioController;
