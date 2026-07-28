import { sequelize } from "../database/connection.js";
import { Fornecedor, Insumo, InsumoCompra, Usuario } from "../models/index.js";

export const listarInsumos = async (req, res) => {
  try {
    const { incluirInativos } = req.query;
    const where = {};

    if (incluirInativos !== "true") {
      where.ativo = true;
    }

    const insumos = await Insumo.findAll({
      where,
      order: [["nome", "ASC"]],
    });

    res.json(insumos);
  } catch (error) {
    console.error("Erro ao listar insumos:", error);
    res.status(500).json({ error: "Erro ao listar insumos" });
  }
};

export const criarInsumo = async (req, res) => {
  try {
    const { nome, unidade, estoqueMinimo, custoUnitarioUltimo, observacao } =
      req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: "Nome do insumo é obrigatório" });
    }

    const insumo = await Insumo.create({
      nome: nome.trim(),
      unidade: unidade || null,
      estoqueMinimo: estoqueMinimo ?? 0,
      custoUnitarioUltimo: custoUnitarioUltimo ?? null,
      observacao: observacao || null,
    });

    res.locals.entityId = insumo.id;
    res.status(201).json(insumo);
  } catch (error) {
    console.error("Erro ao criar insumo:", error);
    res.status(500).json({ error: "Erro ao criar insumo" });
  }
};

export const atualizarInsumo = async (req, res) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);

    if (!insumo) {
      return res.status(404).json({ error: "Insumo não encontrado" });
    }

    const {
      nome,
      unidade,
      quantidadeEstoque,
      estoqueMinimo,
      custoUnitarioUltimo,
      observacao,
      ativo,
    } = req.body;

    await insumo.update({
      nome: nome !== undefined ? nome.trim() : insumo.nome,
      unidade: unidade ?? insumo.unidade,
      quantidadeEstoque: quantidadeEstoque ?? insumo.quantidadeEstoque,
      estoqueMinimo: estoqueMinimo ?? insumo.estoqueMinimo,
      custoUnitarioUltimo: custoUnitarioUltimo ?? insumo.custoUnitarioUltimo,
      observacao: observacao ?? insumo.observacao,
      ativo: ativo ?? insumo.ativo,
    });

    res.locals.entityId = insumo.id;
    res.json(insumo);
  } catch (error) {
    console.error("Erro ao atualizar insumo:", error);
    res.status(500).json({ error: "Erro ao atualizar insumo" });
  }
};

export const deletarInsumo = async (req, res) => {
  try {
    const insumo = await Insumo.findByPk(req.params.id);

    if (!insumo) {
      return res.status(404).json({ error: "Insumo não encontrado" });
    }

    if (!insumo.ativo) {
      await insumo.destroy();
      res.locals.entityId = req.params.id;
      return res.json({
        message: "Insumo excluído permanentemente com sucesso",
        permanentDelete: true,
      });
    }

    await insumo.update({ ativo: false });
    res.locals.entityId = insumo.id;
    res.json({
      message:
        "Insumo desativado com sucesso. Clique novamente para excluir permanentemente.",
      permanentDelete: false,
    });
  } catch (error) {
    console.error("Erro ao excluir insumo:", error);
    res.status(500).json({ error: "Erro ao excluir insumo" });
  }
};

export const listarComprasInsumo = async (req, res) => {
  try {
    const { insumoId } = req.query;
    const where = {};

    if (insumoId) {
      where.insumoId = insumoId;
    }

    const compras = await InsumoCompra.findAll({
      where,
      include: [
        { model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] },
        { model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
      order: [["dataCompra", "DESC"]],
    });

    res.json(compras);
  } catch (error) {
    console.error("Erro ao listar compras de insumo:", error);
    res.status(500).json({ error: "Erro ao listar compras de insumo" });
  }
};

export const criarCompraInsumo = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { quantidade, custoUnitario, custoTotal, fornecedorId, observacao } =
      req.body;

    const insumo = await Insumo.findByPk(req.params.id, { transaction });

    if (!insumo) {
      await transaction.rollback();
      return res.status(404).json({ error: "Insumo não encontrado" });
    }

    const quantidadeNumerica = Number(String(quantidade).replace(",", "."));

    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe uma quantidade válida (maior que zero)" });
    }

    if (fornecedorId) {
      const fornecedor = await Fornecedor.findByPk(fornecedorId, {
        transaction,
      });
      if (!fornecedor) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Fornecedor informado não encontrado" });
      }
    }

    const custoUnitarioNumerico =
      custoUnitario !== undefined && custoUnitario !== null && custoUnitario !== ""
        ? Number(String(custoUnitario).replace(",", "."))
        : null;

    const custoTotalNumerico =
      custoTotal !== undefined && custoTotal !== null && custoTotal !== ""
        ? Number(String(custoTotal).replace(",", "."))
        : custoUnitarioNumerico !== null
          ? custoUnitarioNumerico * quantidadeNumerica
          : null;

    const compra = await InsumoCompra.create(
      {
        insumoId: insumo.id,
        quantidade: quantidadeNumerica,
        custoUnitario: custoUnitarioNumerico,
        custoTotal: custoTotalNumerico,
        fornecedorId: fornecedorId || null,
        usuarioId: req.usuario.id,
        observacao: observacao || null,
      },
      { transaction },
    );

    await insumo.update(
      {
        quantidadeEstoque:
          Number(insumo.quantidadeEstoque) + quantidadeNumerica,
        custoUnitarioUltimo:
          custoUnitarioNumerico !== null
            ? custoUnitarioNumerico
            : insumo.custoUnitarioUltimo,
      },
      { transaction },
    );

    await transaction.commit();

    const compraCompleta = await InsumoCompra.findByPk(compra.id, {
      include: [
        { model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] },
        { model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
    });

    res.locals.entityId = compra.id;
    res.status(201).json(compraCompleta);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao registrar compra de insumo:", error);
    res.status(500).json({ error: "Erro ao registrar compra de insumo" });
  }
};
