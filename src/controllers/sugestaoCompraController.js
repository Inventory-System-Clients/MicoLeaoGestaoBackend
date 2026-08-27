import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  Compra,
  Insumo,
  Loja,
  Peca,
  Produto,
  SugestaoCompra,
  SugestaoCompraItem,
  Usuario,
} from "../models/index.js";

const STATUS_VALIDOS = ["PENDENTE", "ACEITA", "RECUSADA"];

class ErroValidacaoSugestao extends Error {}

const includeItensSugestao = {
  model: SugestaoCompraItem,
  as: "itens",
  include: [
    { model: Produto, as: "produto", attributes: ["id", "codigo", "nome"] },
    { model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] },
    { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
    { model: Loja, as: "loja", attributes: ["id", "nome"] },
  ],
};

const includeSugestao = [
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "respondidoPor", attributes: ["id", "nome"] },
  { model: Compra, as: "compraGerada", attributes: ["id", "status"] },
  includeItensSugestao,
];

// Validação leve: não cria produto/insumo/peça novo aqui — isso só
// acontece de fato quando a sugestão é aceita (validarItem, do
// compraController, faz esse trabalho na hora de virar um pedido de
// compra de verdade).
const validarItemSugestao = (item) => {
  const nomeItem = (item.nomeItem || "").trim();
  if (!nomeItem) {
    throw new ErroValidacaoSugestao("Informe o nome de cada item da sugestão");
  }

  const produtoId = item.produtoId || null;
  const insumoId = item.insumoId || null;
  const pecaId = item.pecaId || null;

  if ([produtoId, insumoId, pecaId].filter(Boolean).length > 1) {
    throw new ErroValidacaoSugestao("Cada item deve ter no máximo um produto, insumo ou peça");
  }

  const quantidadeNumerica = Number(item.quantidade);
  if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
    throw new ErroValidacaoSugestao(`Informe uma quantidade válida para "${nomeItem}"`);
  }

  const tipoItem =
    item.tipoItem || (produtoId ? "PRODUTO" : insumoId ? "INSUMO" : pecaId ? "PECA" : "PRODUTO");

  return {
    tipoItem,
    produtoId,
    insumoId,
    pecaId,
    itemNovo: Boolean(item.itemNovo && !produtoId && !insumoId && !pecaId),
    nomeItem,
    sku: item.sku || null,
    quantidade: quantidadeNumerica,
    unidade: item.unidade || null,
    lojaId: item.lojaId || null,
    descricaoUso: item.descricaoUso || null,
  };
};

export const listarSugestoesCompra = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};

    if (status) {
      const statusLista = status.split(",").filter((s) => STATUS_VALIDOS.includes(s));
      if (statusLista.length > 0) {
        where.status = { [Op.in]: statusLista };
      }
    }

    const sugestoes = await SugestaoCompra.findAll({
      where,
      include: includeSugestao,
      order: [["createdAt", "DESC"]],
    });

    res.json(sugestoes);
  } catch (error) {
    console.error("Erro ao listar sugestões de compra:", error);
    res.status(500).json({ error: "Erro ao listar sugestões de compra" });
  }
};

export const criarSugestaoCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { observacao, itens } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Adicione ao menos um item à sugestão" });
    }

    const itensValidados = itens.map(validarItemSugestao);

    const sugestao = await SugestaoCompra.create(
      {
        observacao: observacao || null,
        criadoPorId: req.usuario.id,
      },
      { transaction },
    );

    await SugestaoCompraItem.bulkCreate(
      itensValidados.map((item) => ({ ...item, sugestaoCompraId: sugestao.id })),
      { transaction },
    );

    await transaction.commit();

    const sugestaoCompleta = await SugestaoCompra.findByPk(sugestao.id, {
      include: includeSugestao,
    });

    res.locals.entityId = sugestao.id;
    res.status(201).json(sugestaoCompleta);
  } catch (error) {
    await transaction.rollback();
    if (error instanceof ErroValidacaoSugestao) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao criar sugestão de compra:", error);
    res.status(500).json({ error: "Erro ao criar sugestão de compra" });
  }
};

// Não existe um "aceitar" isolado aqui: aceitar uma sugestão significa
// usá-la pra montar um pedido de compra de verdade — isso acontece em
// criarCompra (compraController.js), que recebe um sugestaoCompraId
// opcional e marca a sugestão como ACEITA (com o link pro pedido criado)
// dentro da mesma transação. Aqui só fica a recusa, que não precisa criar
// nada.
export const recusarSugestaoCompra = async (req, res) => {
  try {
    const sugestao = await SugestaoCompra.findByPk(req.params.id);

    if (!sugestao) {
      return res.status(404).json({ error: "Sugestão não encontrada" });
    }

    if (sugestao.status !== "PENDENTE") {
      return res.status(400).json({ error: "Esta sugestão já foi respondida" });
    }

    const resposta = String(req.body.resposta || "").trim();
    if (!resposta) {
      return res.status(400).json({ error: "Informe o motivo para não aceitar" });
    }

    await sugestao.update({
      status: "RECUSADA",
      resposta,
      respondidoPorId: req.usuario.id,
      respondidoEm: new Date(),
    });

    const sugestaoAtualizada = await SugestaoCompra.findByPk(sugestao.id, {
      include: includeSugestao,
    });

    res.json(sugestaoAtualizada);
  } catch (error) {
    console.error("Erro ao recusar sugestão de compra:", error);
    res.status(500).json({ error: "Erro ao recusar sugestão de compra" });
  }
};

export default {
  listarSugestoesCompra,
  criarSugestaoCompra,
  recusarSugestaoCompra,
};
