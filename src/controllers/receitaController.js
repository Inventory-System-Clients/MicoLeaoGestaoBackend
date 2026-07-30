import { sequelize } from "../database/connection.js";
import { Insumo, Produto, ReceitaInsumo } from "../models/index.js";

const includeReceita = [
  { model: Produto, as: "produto", attributes: ["id", "codigo", "nome", "emoji"] },
  { model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] },
];

export const listarReceitas = async (req, res) => {
  try {
    const { produtoId } = req.query;
    const where = {};

    if (produtoId) {
      where.produtoId = produtoId;
    }

    const itens = await ReceitaInsumo.findAll({
      where,
      include: includeReceita,
      order: [["createdAt", "ASC"]],
    });

    res.json(itens);
  } catch (error) {
    console.error("Erro ao listar receitas:", error);
    res.status(500).json({ error: "Erro ao listar receitas" });
  }
};

export const salvarReceitaProduto = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { produtoId } = req.params;
    const { itens } = req.body;

    const produto = await Produto.findByPk(produtoId, { transaction });
    if (!produto) {
      await transaction.rollback();
      return res.status(400).json({ error: "Produto informado não encontrado" });
    }

    const listaItens = Array.isArray(itens) ? itens : [];
    const itensValidos = [];

    for (const item of listaItens) {
      const quantidade = Number(String(item.quantidadePorUnidade).replace(",", "."));
      if (!item.insumoId || !Number.isFinite(quantidade) || quantidade <= 0) {
        continue;
      }

      const insumo = await Insumo.findByPk(item.insumoId, { transaction });
      if (!insumo) {
        await transaction.rollback();
        return res.status(400).json({ error: "Insumo informado não encontrado" });
      }

      itensValidos.push({
        produtoId,
        insumoId: item.insumoId,
        quantidadePorUnidade: quantidade,
      });
    }

    await ReceitaInsumo.destroy({ where: { produtoId }, transaction });

    if (itensValidos.length > 0) {
      await ReceitaInsumo.bulkCreate(itensValidos, { transaction });
    }

    await transaction.commit();

    const receitaCompleta = await ReceitaInsumo.findAll({
      where: { produtoId },
      include: includeReceita,
      order: [["createdAt", "ASC"]],
    });

    res.locals.entityId = produtoId;
    res.json(receitaCompleta);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao salvar receita do produto:", error);
    res.status(500).json({ error: "Erro ao salvar receita do produto" });
  }
};
