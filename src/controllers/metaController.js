import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import { MetaLoja, ComissaoMeta, LancamentoMeta, Loja, Usuario } from "../models/index.js";

// Metas por loja (mensais). O financeiro lança o dinheiro que entrou na loja;
// a soma do mês é comparada com bronze/prata/ouro e define a comissão de cada
// usuário cadastrado na meta. Funcionário só vê a porcentagem (sem valores).

const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;
const NIVEIS = ["bronze", "prata", "ouro"];
const NOMES_DEPOSITO = ["deposito principal", "depósito principal"];

const mesAtual = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
const lerMes = (valor) => (MES_VALIDO.test(valor || "") ? valor : mesAtual());

const ultimoDiaDoMes = (mes) => {
  const [ano, numero] = mes.split("-").map(Number);
  return `${mes}-${String(new Date(Date.UTC(ano, numero, 0)).getUTCDate()).padStart(2, "0")}`;
};

const mesAnterior = (mes) => {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(Date.UTC(ano, numero - 2, 1));
  return data.toISOString().slice(0, 7);
};

const dinheiro = (valor) => {
  const numero = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : null;
};

// Maior nível alcançado: null, "bronze", "prata" ou "ouro"
const nivelAtingido = (realizado, meta) => {
  let nivel = null;
  if (realizado >= Number(meta.valorBronze)) nivel = "bronze";
  if (realizado >= Number(meta.valorPrata)) nivel = "prata";
  if (realizado >= Number(meta.valorOuro)) nivel = "ouro";
  return nivel;
};

const valorDaComissao = (comissao, nivel, realizado) => {
  if (!nivel) return 0;
  const taxa = Number(comissao[nivel]) || 0;
  return comissao.tipo === "PERCENTUAL"
    ? Math.round(realizado * taxa) / 100
    : taxa;
};

// Soma dos lançamentos do mês por loja: { lojaId: total }
const realizadoPorLoja = async (mes, lojaIds) => {
  const where = { data: { [Op.between]: [`${mes}-01`, ultimoDiaDoMes(mes)] } };
  if (lojaIds) where.lojaId = lojaIds;
  const linhas = await LancamentoMeta.findAll({
    where,
    attributes: ["lojaId", [sequelize.fn("SUM", sequelize.col("valor")), "total"]],
    group: ["lojaId"],
    raw: true,
  });
  return Object.fromEntries(linhas.map((linha) => [linha.lojaId, Number(linha.total) || 0]));
};

const formatarMeta = (meta, realizado) => {
  const dados = meta.toJSON();
  const valores = {
    valorBronze: Number(dados.valorBronze),
    valorPrata: Number(dados.valorPrata),
    valorOuro: Number(dados.valorOuro),
  };
  const nivel = nivelAtingido(realizado, valores);
  return {
    ...dados,
    ...valores,
    realizado,
    nivel,
    percentual: valores.valorOuro > 0 ? Math.round((realizado / valores.valorOuro) * 1000) / 10 : 0,
    comissoes: (dados.comissoes || []).map((comissao) => {
      const formatada = {
        ...comissao,
        bronze: Number(comissao.bronze),
        prata: Number(comissao.prata),
        ouro: Number(comissao.ouro),
      };
      return { ...formatada, valorAtual: valorDaComissao(formatada, nivel, realizado) };
    }),
  };
};

const validarMeta = ({ valorBronze, valorPrata, valorOuro }) => {
  if ([valorBronze, valorPrata, valorOuro].some((valor) => valor === null || valor <= 0)) {
    return "Informe os valores de bronze, prata e ouro.";
  }
  if (!(valorBronze < valorPrata && valorPrata < valorOuro)) {
    return "Os valores precisam subir: bronze < prata < ouro.";
  }
  return null;
};

const lerComissoes = (lista) => {
  if (!Array.isArray(lista)) return { comissoes: [] };
  const comissoes = [];
  const vistos = new Set();
  for (const item of lista) {
    if (!item?.usuarioId) continue;
    if (vistos.has(item.usuarioId)) return { erro: "A mesma pessoa aparece duas vezes nas comissões." };
    vistos.add(item.usuarioId);
    const tipo = item.tipo === "PERCENTUAL" ? "PERCENTUAL" : "FIXO";
    const valores = Object.fromEntries(NIVEIS.map((nivel) => [nivel, dinheiro(item[nivel]) ?? 0]));
    if (NIVEIS.some((nivel) => valores[nivel] < 0)) return { erro: "Comissão não pode ser negativa." };
    if (tipo === "PERCENTUAL" && NIVEIS.some((nivel) => valores[nivel] > 100)) {
      return { erro: "Porcentagem de comissão acima de 100%." };
    }
    comissoes.push({ usuarioId: item.usuarioId, tipo, ...valores });
  }
  return { comissoes };
};

const incluirComissoes = {
  model: ComissaoMeta,
  as: "comissoes",
  include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome", "role"] }],
};

const metaController = {
  // Tela de metas: lojas, metas do mês com realizado, nível e comissões
  async listar(req, res) {
    try {
      const mes = lerMes(req.query.mes);
      const [lojas, metas, realizados, usuarios] = await Promise.all([
        Loja.findAll({ where: { ativo: true }, attributes: ["id", "nome", "cidade"], order: [["nome", "ASC"]] }),
        MetaLoja.findAll({ where: { mes }, include: [incluirComissoes] }),
        realizadoPorLoja(mes),
        Usuario.findAll({
          where: { ativo: true, role: { [Op.notIn]: ["ADMIN", "DESENVOLVEDOR"] } },
          attributes: ["id", "nome", "role"],
          order: [["nome", "ASC"]],
        }),
      ]);
      const metaPorLoja = new Map(metas.map((meta) => [meta.lojaId, meta]));
      const linhas = lojas
        .filter((loja) => !NOMES_DEPOSITO.includes(String(loja.nome).trim().toLowerCase()))
        .map((loja) => {
          const realizado = realizados[loja.id] || 0;
          const meta = metaPorLoja.get(loja.id);
          return { loja: loja.toJSON(), realizado, meta: meta ? formatarMeta(meta, realizado) : null };
        });
      res.json({ mes, lojas: linhas, usuarios });
    } catch (error) {
      console.error("Erro ao listar metas:", error);
      res.status(500).json({ error: "Erro ao carregar as metas" });
    }
  },

  // Cria ou atualiza a meta de uma loja no mês, junto com as comissões
  async salvar(req, res) {
    const mes = req.body.mes;
    const { lojaId } = req.body;
    if (!MES_VALIDO.test(mes || "")) return res.status(400).json({ error: "Mês inválido." });
    const valores = {
      valorBronze: dinheiro(req.body.valorBronze),
      valorPrata: dinheiro(req.body.valorPrata),
      valorOuro: dinheiro(req.body.valorOuro),
    };
    const erroMeta = validarMeta(valores);
    if (erroMeta) return res.status(400).json({ error: erroMeta });
    const { comissoes, erro } = lerComissoes(req.body.comissoes);
    if (erro) return res.status(400).json({ error: erro });

    try {
      if (!(await Loja.findByPk(lojaId))) return res.status(404).json({ error: "Loja não encontrada" });
      const resultado = await sequelize.transaction(async (transaction) => {
        const [meta] = await MetaLoja.findOrCreate({
          where: { lojaId, mes },
          defaults: { lojaId, mes, ...valores, atualizadoPorId: req.usuario.id },
          transaction,
        });
        await meta.update({ ...valores, atualizadoPorId: req.usuario.id }, { transaction });
        await ComissaoMeta.destroy({ where: { metaId: meta.id }, transaction });
        if (comissoes.length) {
          await ComissaoMeta.bulkCreate(
            comissoes.map((comissao) => ({ ...comissao, metaId: meta.id })),
            { transaction },
          );
        }
        return meta.id;
      });
      const meta = await MetaLoja.findByPk(resultado, { include: [incluirComissoes] });
      const realizado = (await realizadoPorLoja(mes, [lojaId]))[lojaId] || 0;
      res.json(formatarMeta(meta, realizado));
    } catch (error) {
      console.error("Erro ao salvar meta:", error);
      res.status(500).json({ error: "Erro ao salvar a meta" });
    }
  },

  async excluir(req, res) {
    try {
      const meta = await MetaLoja.findByPk(req.params.id);
      if (!meta) return res.status(404).json({ error: "Meta não encontrada" });
      await sequelize.transaction(async (transaction) => {
        await ComissaoMeta.destroy({ where: { metaId: meta.id }, transaction });
        await meta.destroy({ transaction });
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Erro ao excluir meta:", error);
      res.status(500).json({ error: "Erro ao excluir a meta" });
    }
  },

  // Copia metas e comissões do mês anterior para as lojas que ainda não têm
  async copiarMesAnterior(req, res) {
    const mes = req.body.mes;
    if (!MES_VALIDO.test(mes || "")) return res.status(400).json({ error: "Mês inválido." });
    try {
      const copiadas = await sequelize.transaction(async (transaction) => {
        const anteriores = await MetaLoja.findAll({
          where: { mes: mesAnterior(mes) },
          include: [{ model: ComissaoMeta, as: "comissoes" }],
          transaction,
        });
        const jaTem = new Set(
          (await MetaLoja.findAll({ where: { mes }, attributes: ["lojaId"], transaction })).map((m) => m.lojaId),
        );
        let total = 0;
        for (const anterior of anteriores) {
          if (jaTem.has(anterior.lojaId)) continue;
          const nova = await MetaLoja.create(
            {
              lojaId: anterior.lojaId,
              mes,
              valorBronze: anterior.valorBronze,
              valorPrata: anterior.valorPrata,
              valorOuro: anterior.valorOuro,
              atualizadoPorId: req.usuario.id,
            },
            { transaction },
          );
          if (anterior.comissoes.length) {
            await ComissaoMeta.bulkCreate(
              anterior.comissoes.map((c) => ({
                metaId: nova.id,
                usuarioId: c.usuarioId,
                tipo: c.tipo,
                bronze: c.bronze,
                prata: c.prata,
                ouro: c.ouro,
              })),
              { transaction },
            );
          }
          total += 1;
        }
        return total;
      });
      res.json({ copiadas });
    } catch (error) {
      console.error("Erro ao copiar metas:", error);
      res.status(500).json({ error: "Erro ao copiar as metas" });
    }
  },

  async listarLancamentos(req, res) {
    try {
      const mes = lerMes(req.query.mes);
      const where = { data: { [Op.between]: [`${mes}-01`, ultimoDiaDoMes(mes)] } };
      if (req.query.lojaId) where.lojaId = req.query.lojaId;
      const lancamentos = await LancamentoMeta.findAll({
        where,
        include: [
          { model: Loja, as: "loja", attributes: ["id", "nome"] },
          { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
        ],
        order: [["data", "DESC"], ["createdAt", "DESC"]],
      });
      res.json(lancamentos.map((l) => ({ ...l.toJSON(), valor: Number(l.valor) })));
    } catch (error) {
      console.error("Erro ao listar lançamentos de meta:", error);
      res.status(500).json({ error: "Erro ao carregar os lançamentos" });
    }
  },

  async lancar(req, res) {
    try {
      const { lojaId, data } = req.body;
      const valor = dinheiro(req.body.valor);
      if (!DIA_VALIDO.test(data || "")) return res.status(400).json({ error: "Informe a data." });
      if (valor === null || valor === 0) return res.status(400).json({ error: "Informe o valor." });
      if (!(await Loja.findByPk(lojaId))) return res.status(404).json({ error: "Loja não encontrada" });
      const lancamento = await LancamentoMeta.create({
        lojaId,
        data,
        valor,
        observacao: req.body.observacao ? String(req.body.observacao).slice(0, 255) : null,
        criadoPorId: req.usuario.id,
      });
      res.status(201).json({ ...lancamento.toJSON(), valor: Number(lancamento.valor) });
    } catch (error) {
      console.error("Erro ao lançar valor da meta:", error);
      res.status(500).json({ error: "Erro ao salvar o lançamento" });
    }
  },

  async excluirLancamento(req, res) {
    try {
      const lancamento = await LancamentoMeta.findByPk(req.params.id);
      if (!lancamento) return res.status(404).json({ error: "Lançamento não encontrado" });
      await lancamento.destroy();
      res.json({ ok: true });
    } catch (error) {
      console.error("Erro ao excluir lançamento da meta:", error);
      res.status(500).json({ error: "Erro ao excluir o lançamento" });
    }
  },

  // Funcionário: só porcentagem e nível das lojas em que tem comissão.
  // Nenhum valor em R$ sai daqui (nem meta, nem realizado, nem comissão).
  async minhas(req, res) {
    try {
      const mes = mesAtual();
      const comissoes = await ComissaoMeta.findAll({
        where: { usuarioId: req.usuario.id },
        include: [
          {
            model: MetaLoja,
            as: "meta",
            where: { mes },
            include: [{ model: Loja, as: "loja", attributes: ["id", "nome"] }],
          },
        ],
      });
      const realizados = await realizadoPorLoja(
        mes,
        comissoes.map((c) => c.meta.lojaId),
      );
      const [ano, numero] = mes.split("-").map(Number);
      const diasNoMes = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
      const hoje = Number(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(8, 10));

      const metas = comissoes.map(({ meta }) => {
        const ouro = Number(meta.valorOuro);
        const realizado = realizados[meta.lojaId] || 0;
        const porcento = (valor) => Math.round((valor / ouro) * 1000) / 10;
        return {
          lojaId: meta.lojaId,
          loja: meta.loja?.nome,
          percentual: porcento(realizado),
          marcos: { bronze: porcento(Number(meta.valorBronze)), prata: porcento(Number(meta.valorPrata)), ouro: 100 },
          nivel: nivelAtingido(realizado, meta),
        };
      });
      res.json({ mes, diasNoMes, diaAtual: hoje, metas });
    } catch (error) {
      console.error("Erro ao carregar minhas metas:", error);
      res.status(500).json({ error: "Erro ao carregar as metas" });
    }
  },
};

export default metaController;
