import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  EstoqueLoja,
  Insumo,
  InsumoConsumo,
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
  {
    model: InsumoConsumo,
    as: "insumosConsumidos",
    include: [{ model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] }],
  },
];

export const listarPedidosPelucia = async (req, res) => {
  try {
    const {
      status,
      produtoId,
      dataInicio,
      dataFim,
      criadoPorId,
      concluidoPorId,
    } = req.query;
    const where = {};

    if (status && ["PENDENTE", "CONCLUIDO"].includes(status)) {
      where.status = status;
    }

    if (produtoId) {
      where.produtoId = produtoId;
    }

    if (criadoPorId) {
      where.criadoPorId = criadoPorId;
    }

    if (concluidoPorId) {
      where.concluidoPorId = concluidoPorId;
    }

    if (dataInicio || dataFim) {
      const campoData = status === "CONCLUIDO" ? "concluidoEm" : "createdAt";
      where[campoData] = {};
      if (dataInicio) {
        where[campoData][Op.gte] = new Date(`${dataInicio}T00:00:00.000-03:00`);
      }
      if (dataFim) {
        where[campoData][Op.lte] = new Date(`${dataFim}T23:59:59.999-03:00`);
      }
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

    const insumosBody = Array.isArray(req.body?.insumos) ? req.body.insumos : [];

    for (const item of insumosBody) {
      const quantidadeNumerica = Number(
        String(item.quantidade).replace(",", "."),
      );

      if (!item.insumoId || !Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Informe um insumo e uma quantidade válida (maior que zero)" });
      }

      const insumo = await Insumo.findByPk(item.insumoId, { transaction });
      if (!insumo) {
        await transaction.rollback();
        return res.status(400).json({ error: "Insumo informado não encontrado" });
      }

      const saldoRestante = Number(insumo.quantidadeEstoque) - quantidadeNumerica;
      if (saldoRestante < 0) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Estoque insuficiente de "${insumo.nome}" (disponível: ${insumo.quantidadeEstoque} ${insumo.unidade || ""})`,
        });
      }

      await insumo.update({ quantidadeEstoque: saldoRestante }, { transaction });

      await InsumoConsumo.create(
        {
          insumoId: insumo.id,
          quantidade: quantidadeNumerica,
          pedidoPeluciaId: pedido.id,
          usuarioId: req.usuario.id,
          observacao: `Producao de pelucia - Pedido ${pedido.id}`,
        },
        { transaction },
      );
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
