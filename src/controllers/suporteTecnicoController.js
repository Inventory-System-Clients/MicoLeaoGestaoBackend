import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  SuporteItem,
  SuporteMovimentacao,
  SuporteDevolucaoPendente,
  Usuario,
} from "../models/index.js";

const CATEGORIAS_POR_TIPO = {
  SAIDA: ["VENDA", "TROCA"],
  ENTRADA: ["COMPRA", "DEVOLUCAO"],
};

const includeUsuario = {
  model: Usuario,
  as: "usuario",
  attributes: ["id", "nome", "email", "role"],
};

const includeCriadoPor = {
  model: Usuario,
  as: "criadoPor",
  attributes: ["id", "nome", "email", "role"],
};

export const listarItens = async (req, res) => {
  try {
    const { tipo, busca } = req.query;
    const where = { ativo: true };

    if (tipo && ["PECA", "PRODUTO"].includes(tipo)) {
      where.tipo = tipo;
    }

    if (busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${busca}%` } },
        { codigo: { [Op.iLike]: `%${busca}%` } },
      ];
    }

    const itens = await SuporteItem.findAll({
      where,
      order: [["nome", "ASC"]],
    });

    res.json(itens);
  } catch (error) {
    console.error("Erro ao listar itens de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao listar itens" });
  }
};

export const criarItem = async (req, res) => {
  try {
    const { nome, tipo, codigo, descricao, estoqueMinimo, quantidade } =
      req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: "Nome é obrigatório" });
    }

    if (!["PECA", "PRODUTO"].includes(tipo)) {
      return res
        .status(400)
        .json({ error: "Tipo deve ser PECA ou PRODUTO" });
    }

    const quantidadeInicial = Number.isInteger(quantidade)
      ? quantidade
      : 0;
    if (quantidadeInicial < 0) {
      return res
        .status(400)
        .json({ error: "Quantidade inicial não pode ser negativa" });
    }

    const item = await SuporteItem.create({
      nome: nome.trim(),
      tipo,
      codigo: codigo?.trim() || null,
      descricao: descricao?.trim() || null,
      estoqueMinimo: Number.isInteger(estoqueMinimo) ? estoqueMinimo : 0,
      quantidade: quantidadeInicial,
      criadoPorId: req.usuario.id,
    });

    res.locals.entityId = item.id;
    res.status(201).json(item);
  } catch (error) {
    console.error("Erro ao criar item de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao criar item" });
  }
};

export const editarItem = async (req, res) => {
  try {
    const item = await SuporteItem.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const { nome, tipo, codigo, descricao, estoqueMinimo } = req.body;

    if (nome !== undefined) {
      if (!nome.trim()) {
        return res.status(400).json({ error: "Nome é obrigatório" });
      }
      item.nome = nome.trim();
    }

    if (tipo !== undefined) {
      if (!["PECA", "PRODUTO"].includes(tipo)) {
        return res
          .status(400)
          .json({ error: "Tipo deve ser PECA ou PRODUTO" });
      }
      item.tipo = tipo;
    }

    if (codigo !== undefined) item.codigo = codigo?.trim() || null;
    if (descricao !== undefined) item.descricao = descricao?.trim() || null;
    if (estoqueMinimo !== undefined) {
      if (!Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) {
        return res
          .status(400)
          .json({ error: "Estoque mínimo deve ser um número inteiro >= 0" });
      }
      item.estoqueMinimo = estoqueMinimo;
    }

    await item.save();

    res.json(item);
  } catch (error) {
    console.error("Erro ao editar item de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao editar item" });
  }
};

export const desativarItem = async (req, res) => {
  try {
    const item = await SuporteItem.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    item.ativo = false;
    await item.save();

    res.json({ message: "Item desativado com sucesso" });
  } catch (error) {
    console.error("Erro ao desativar item de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao desativar item" });
  }
};

export const registrarMovimentacao = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { itemId, tipo, categoria, quantidade, motivo, devolucaoPendenteId } =
      req.body;

    if (!itemId) {
      await transaction.rollback();
      return res.status(400).json({ error: "Item é obrigatório" });
    }

    if (!["ENTRADA", "SAIDA"].includes(tipo)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Tipo deve ser ENTRADA ou SAIDA" });
    }

    if (!CATEGORIAS_POR_TIPO[tipo].includes(categoria)) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Categoria deve ser ${CATEGORIAS_POR_TIPO[tipo].join(" ou ")} para ${tipo === "ENTRADA" ? "entradas" : "saídas"}`,
      });
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Quantidade deve ser um número inteiro maior que zero" });
    }

    if (!motivo || !motivo.trim()) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe o motivo da entrada/saída" });
    }

    let devolucaoPendente = null;

    if (categoria === "DEVOLUCAO") {
      if (!devolucaoPendenteId) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Selecione a devolução pendente que está sendo devolvida",
        });
      }

      devolucaoPendente = await SuporteDevolucaoPendente.findOne({
        where: { id: devolucaoPendenteId, itemId, status: "PENDENTE" },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!devolucaoPendente) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ error: "Devolução pendente não encontrada" });
      }

      if (devolucaoPendente.quantidade !== quantidade) {
        await transaction.rollback();
        return res.status(400).json({
          error: `A quantidade deve ser igual à da devolução pendente (${devolucaoPendente.quantidade})`,
        });
      }
    }

    const item = await SuporteItem.findOne({
      where: { id: itemId, ativo: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const quantidadeAnterior = item.quantidade;

    if (tipo === "SAIDA" && quantidade > quantidadeAnterior) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Quantidade insuficiente em estoque. Disponível: ${quantidadeAnterior}`,
      });
    }

    const quantidadeAtual =
      tipo === "ENTRADA"
        ? quantidadeAnterior + quantidade
        : quantidadeAnterior - quantidade;

    await item.update({ quantidade: quantidadeAtual }, { transaction });

    const movimentacao = await SuporteMovimentacao.create(
      {
        itemId,
        tipo,
        categoria,
        quantidade,
        motivo: motivo.trim(),
        quantidadeAnterior,
        quantidadeAtual,
        usuarioId: req.usuario.id,
      },
      { transaction },
    );

    if (categoria === "TROCA") {
      await SuporteDevolucaoPendente.create(
        {
          itemId,
          quantidade,
          motivo: motivo.trim(),
          status: "PENDENTE",
          movimentacaoOrigemId: movimentacao.id,
          criadoPorId: req.usuario.id,
        },
        { transaction },
      );
    }

    if (categoria === "DEVOLUCAO") {
      await devolucaoPendente.update(
        { status: "CONCLUIDA", movimentacaoResolucaoId: movimentacao.id },
        { transaction },
      );
    }

    await transaction.commit();

    const movimentacaoCompleta = await SuporteMovimentacao.findByPk(
      movimentacao.id,
      {
        include: [
          { model: SuporteItem, as: "item" },
          includeUsuario,
        ],
      },
    );

    res.locals.entityId = movimentacao.id;
    res.status(201).json(movimentacaoCompleta);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao registrar movimentação de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao registrar movimentação" });
  }
};

export const listarMovimentacoes = async (req, res) => {
  try {
    const { itemId, tipo, categoria, usuarioId, dataInicio, dataFim } =
      req.query;
    const where = {};

    if (itemId) where.itemId = itemId;
    if (usuarioId) where.usuarioId = usuarioId;
    if (tipo && ["ENTRADA", "SAIDA"].includes(tipo)) where.tipo = tipo;
    if (categoria && ["VENDA", "TROCA", "COMPRA", "DEVOLUCAO"].includes(categoria)) {
      where.categoria = categoria;
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

    const movimentacoes = await SuporteMovimentacao.findAll({
      where,
      include: [
        { model: SuporteItem, as: "item" },
        includeUsuario,
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(movimentacoes);
  } catch (error) {
    console.error("Erro ao listar movimentações de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao listar movimentações" });
  }
};

export const listarDevolucoesPendentes = async (req, res) => {
  try {
    const { itemId, status } = req.query;
    const where = {};

    if (itemId) where.itemId = itemId;
    where.status =
      status && ["PENDENTE", "CONCLUIDA"].includes(status)
        ? status
        : "PENDENTE";

    const devolucoes = await SuporteDevolucaoPendente.findAll({
      where,
      include: [
        { model: SuporteItem, as: "item" },
        {
          model: SuporteMovimentacao,
          as: "movimentacaoOrigem",
          include: [includeUsuario],
        },
        includeCriadoPor,
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(devolucoes);
  } catch (error) {
    console.error("Erro ao listar devoluções pendentes de suporte técnico:", error);
    res.status(500).json({ error: "Erro ao listar devoluções pendentes" });
  }
};
