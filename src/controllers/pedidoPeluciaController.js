import { sequelize } from "../database/connection.js";
import {
  EstoqueLoja,
  MovimentacaoEstoqueLoja,
  MovimentacaoEstoqueLojaProduto,
  PedidoPelucia,
  Produto,
  Usuario,
} from "../models/index.js";
import { obterOuCriarEstoqueCentral } from "./movimentacaoEstoqueLojaController.js";

const includePedido = [
  { model: Produto, as: "produto", attributes: ["id", "codigo", "nome", "categoria", "emoji"] },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome", "email"] },
  { model: Usuario, as: "concluidoPor", attributes: ["id", "nome", "email"] },
];

export const listarPedidosPelucia = async (req, res) => {
  try {
    const { status, produtoId } = req.query;
    const where = {};

    if (status && ["PENDENTE", "CONCLUIDO"].includes(status)) {
      where.status = status;
    }

    if (produtoId) {
      where.produtoId = produtoId;
    }

    const pedidos = await PedidoPelucia.findAll({
      where,
      include: includePedido,
      order: [["createdAt", "DESC"]],
    });

    res.json(pedidos);
  } catch (error) {
    console.error("Erro ao listar pedidos de pelúcia:", error);
    res.status(500).json({ error: "Erro ao listar pedidos de pelúcia" });
  }
};

export const criarPedidoPelucia = async (req, res) => {
  try {
    const { produtoId, quantidade, observacao } = req.body;

    if (!produtoId) {
      return res.status(400).json({ error: "Produto é obrigatório" });
    }

    const quantidadeNumerica = Number(quantidade);
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      return res
        .status(400)
        .json({ error: "Informe uma quantidade válida (inteiro maior que zero)" });
    }

    const produto = await Produto.findByPk(produtoId);
    if (!produto) {
      return res.status(400).json({ error: "Produto informado não encontrado" });
    }

    const pedido = await PedidoPelucia.create({
      produtoId,
      quantidade: quantidadeNumerica,
      observacao: observacao || null,
      criadoPorId: req.usuario.id,
    });

    const pedidoCompleto = await PedidoPelucia.findByPk(pedido.id, {
      include: includePedido,
    });

    res.locals.entityId = pedido.id;
    res.status(201).json(pedidoCompleto);
  } catch (error) {
    console.error("Erro ao criar pedido de pelúcia:", error);
    res.status(500).json({ error: "Erro ao criar pedido de pelúcia" });
  }
};

export const darBaixaPedidoPelucia = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const pedido = await PedidoPelucia.findByPk(req.params.id, { transaction });

    if (!pedido) {
      await transaction.rollback();
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    if (pedido.status === "CONCLUIDO") {
      await transaction.rollback();
      return res.status(400).json({ error: "Este pedido já foi concluído" });
    }

    const estoqueCentral = await obterOuCriarEstoqueCentral(transaction);

    const [estoque] = await EstoqueLoja.findOrCreate({
      where: { lojaId: estoqueCentral.id, produtoId: pedido.produtoId },
      defaults: { quantidade: 0 },
      transaction,
    });

    await estoque.update(
      { quantidade: Number(estoque.quantidade || 0) + pedido.quantidade },
      { transaction },
    );

    const movimentacao = await MovimentacaoEstoqueLoja.create(
      {
        lojaId: estoqueCentral.id,
        usuarioId: req.usuario.id,
        observacao: `Produção de pelúcia - Pedido ${pedido.id}${pedido.observacao ? ` | ${pedido.observacao}` : ""}`,
        dataMovimentacao: new Date(),
      },
      { transaction },
    );

    await MovimentacaoEstoqueLojaProduto.create(
      {
        movimentacaoEstoqueLojaId: movimentacao.id,
        produtoId: pedido.produtoId,
        quantidade: pedido.quantidade,
        tipoMovimentacao: "entrada",
      },
      { transaction },
    );

    await pedido.update(
      {
        status: "CONCLUIDO",
        concluidoPorId: req.usuario.id,
        concluidoEm: new Date(),
        movimentacaoEstoqueLojaId: movimentacao.id,
      },
      { transaction },
    );

    await transaction.commit();

    const pedidoCompleto = await PedidoPelucia.findByPk(pedido.id, {
      include: includePedido,
    });

    res.json(pedidoCompleto);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao dar baixa no pedido de pelúcia:", error);
    res.status(500).json({ error: "Erro ao dar baixa no pedido de pelúcia" });
  }
};
