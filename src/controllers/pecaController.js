import { sequelize } from "../database/connection.js";
import {
  EstoquePecaFuncionario,
  MovimentacaoPeca,
  Peca,
  Usuario,
} from "../models/index.js";

export const listarPecas = async (req, res) => {
  try {
    const { incluirInativas } = req.query;
    const where = {};

    if (incluirInativas !== "true") {
      where.ativo = true;
    }

    const pecas = await Peca.findAll({
      where,
      order: [["nome", "ASC"]],
    });

    res.json(pecas);
  } catch (error) {
    console.error("Erro ao listar peças:", error);
    res.status(500).json({ error: "Erro ao listar peças" });
  }
};

export const criarPeca = async (req, res) => {
  try {
    const {
      codigo,
      nome,
      descricao,
      unidade,
      quantidadeEstoque,
      estoqueMinimo,
      custoUnitario,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: "Nome da peça é obrigatório" });
    }

    if (codigo) {
      const existente = await Peca.findOne({ where: { codigo } });
      if (existente) {
        return res.status(400).json({ error: "Código de peça já existe" });
      }
    }

    const peca = await Peca.create({
      codigo: codigo || null,
      nome: nome.trim(),
      descricao: descricao || null,
      unidade: unidade || null,
      quantidadeEstoque: quantidadeEstoque || 0,
      estoqueMinimo: estoqueMinimo ?? 0,
      custoUnitario: custoUnitario ?? null,
    });

    res.locals.entityId = peca.id;
    res.status(201).json(peca);
  } catch (error) {
    console.error("Erro ao criar peça:", error);
    res.status(500).json({ error: "Erro ao criar peça" });
  }
};

export const atualizarPeca = async (req, res) => {
  try {
    const peca = await Peca.findByPk(req.params.id);

    if (!peca) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }

    const {
      codigo,
      nome,
      descricao,
      unidade,
      quantidadeEstoque,
      estoqueMinimo,
      custoUnitario,
      ativo,
    } = req.body;

    if (codigo && codigo !== peca.codigo) {
      const existente = await Peca.findOne({ where: { codigo } });
      if (existente) {
        return res.status(400).json({ error: "Código de peça já existe" });
      }
    }

    await peca.update({
      codigo: codigo ?? peca.codigo,
      nome: nome !== undefined ? nome.trim() : peca.nome,
      descricao: descricao ?? peca.descricao,
      unidade: unidade ?? peca.unidade,
      quantidadeEstoque: quantidadeEstoque ?? peca.quantidadeEstoque,
      estoqueMinimo: estoqueMinimo ?? peca.estoqueMinimo,
      custoUnitario: custoUnitario ?? peca.custoUnitario,
      ativo: ativo ?? peca.ativo,
    });

    res.locals.entityId = peca.id;
    res.json(peca);
  } catch (error) {
    console.error("Erro ao atualizar peça:", error);
    res.status(500).json({ error: "Erro ao atualizar peça" });
  }
};

export const deletarPeca = async (req, res) => {
  try {
    const peca = await Peca.findByPk(req.params.id);

    if (!peca) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }

    if (!peca.ativo) {
      await peca.destroy();
      res.locals.entityId = req.params.id;
      return res.json({
        message: "Peça excluída permanentemente com sucesso",
        permanentDelete: true,
      });
    }

    await peca.update({ ativo: false });
    res.locals.entityId = peca.id;
    res.json({
      message:
        "Peça desativada com sucesso. Clique novamente para excluir permanentemente.",
      permanentDelete: false,
    });
  } catch (error) {
    console.error("Erro ao excluir peça:", error);
    res.status(500).json({ error: "Erro ao excluir peça" });
  }
};

export const lancarQuantidadePeca = async (req, res) => {
  try {
    const { quantidade } = req.body;
    const quantidadeNumerica = Number(quantidade);

    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      return res
        .status(400)
        .json({ error: "Informe uma quantidade válida (inteiro maior que zero)" });
    }

    const peca = await Peca.findByPk(req.params.id);
    if (!peca) {
      return res.status(404).json({ error: "Peça não encontrada" });
    }

    await peca.update({
      quantidadeEstoque: peca.quantidadeEstoque + quantidadeNumerica,
    });

    res.locals.entityId = peca.id;
    res.json(peca);
  } catch (error) {
    console.error("Erro ao lançar quantidade de peça:", error);
    res.status(500).json({ error: "Erro ao lançar quantidade de peça" });
  }
};

export const enviarPecaFuncionario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { funcionarioId, quantidade, observacao } = req.body;
    const quantidadeNumerica = Number(quantidade);

    if (!funcionarioId) {
      await transaction.rollback();
      return res.status(400).json({ error: "Selecione o funcionário" });
    }

    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe uma quantidade válida (inteiro maior que zero)" });
    }

    const peca = await Peca.findByPk(req.params.id, { transaction });
    if (!peca || !peca.ativo) {
      await transaction.rollback();
      return res.status(404).json({ error: "Peça não encontrada" });
    }

    const funcionario = await Usuario.findOne({
      where: { id: funcionarioId, role: "FUNCIONARIO", ativo: true },
      transaction,
    });
    if (!funcionario) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Funcionário informado inválido ou inativo" });
    }

    if (peca.quantidadeEstoque < quantidadeNumerica) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Estoque central insuficiente. Disponível: ${peca.quantidadeEstoque}, solicitado: ${quantidadeNumerica}.`,
      });
    }

    await peca.update(
      { quantidadeEstoque: peca.quantidadeEstoque - quantidadeNumerica },
      { transaction },
    );

    const [estoqueFuncionario] = await EstoquePecaFuncionario.findOrCreate({
      where: { funcionarioId, pecaId: peca.id },
      defaults: { quantidade: 0 },
      transaction,
    });

    await estoqueFuncionario.update(
      { quantidade: estoqueFuncionario.quantidade + quantidadeNumerica },
      { transaction },
    );

    const envio = await MovimentacaoPeca.create(
      {
        pecaId: peca.id,
        funcionarioId,
        quantidade: quantidadeNumerica,
        usuarioId: req.usuario.id,
        observacao: observacao || null,
      },
      { transaction },
    );

    await transaction.commit();

    const envioCompleto = await MovimentacaoPeca.findByPk(envio.id, {
      include: [
        { model: Peca, as: "peca", attributes: ["id", "nome", "unidade"] },
        { model: Usuario, as: "funcionario", attributes: ["id", "nome"] },
        { model: Usuario, as: "enviadoPor", attributes: ["id", "nome"] },
      ],
    });

    res.locals.entityId = envio.id;
    res.status(201).json(envioCompleto);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao enviar peça para funcionário:", error);
    res.status(500).json({ error: "Erro ao enviar peça para funcionário" });
  }
};

export const devolverPecaFuncionario = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { quantidade, observacao } = req.body;
    const quantidadeNumerica = Number(quantidade);
    const funcionarioId = req.usuario.id;

    if (req.usuario.role !== "FUNCIONARIO") {
      await transaction.rollback();
      return res.status(403).json({
        error: "Apenas funcionario pode devolver peca pelo proprio carrinho",
      });
    }

    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe uma quantidade valida (inteiro maior que zero)" });
    }

    const peca = await Peca.findByPk(req.params.id, { transaction });
    if (!peca || !peca.ativo) {
      await transaction.rollback();
      return res.status(404).json({ error: "Peca nao encontrada" });
    }

    const estoqueFuncionario = await EstoquePecaFuncionario.findOne({
      where: { funcionarioId, pecaId: peca.id },
      transaction,
    });

    if (!estoqueFuncionario || estoqueFuncionario.quantidade < quantidadeNumerica) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Quantidade insuficiente no seu carrinho. Disponivel: ${
          estoqueFuncionario?.quantidade || 0
        }, solicitado: ${quantidadeNumerica}.`,
      });
    }

    await estoqueFuncionario.update(
      { quantidade: estoqueFuncionario.quantidade - quantidadeNumerica },
      { transaction },
    );

    await peca.update(
      { quantidadeEstoque: peca.quantidadeEstoque + quantidadeNumerica },
      { transaction },
    );

    const devolucao = await MovimentacaoPeca.create(
      {
        pecaId: peca.id,
        funcionarioId,
        quantidade: -quantidadeNumerica,
        usuarioId: funcionarioId,
        observacao: observacao || "Devolucao do funcionario",
      },
      { transaction },
    );

    await transaction.commit();

    const devolucaoCompleta = await MovimentacaoPeca.findByPk(devolucao.id, {
      include: [
        { model: Peca, as: "peca", attributes: ["id", "nome", "unidade"] },
        { model: Usuario, as: "funcionario", attributes: ["id", "nome"] },
        { model: Usuario, as: "enviadoPor", attributes: ["id", "nome"] },
      ],
    });

    res.locals.entityId = devolucao.id;
    res.status(201).json(devolucaoCompleta);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao devolver peca:", error);
    res.status(500).json({ error: "Erro ao devolver peca" });
  }
};

export const listarEnviosPeca = async (req, res) => {
  try {
    const { pecaId, funcionarioId } = req.query;
    const where = {};

    if (pecaId) where.pecaId = pecaId;
    if (funcionarioId) where.funcionarioId = funcionarioId;

    const envios = await MovimentacaoPeca.findAll({
      where,
      include: [
        { model: Peca, as: "peca", attributes: ["id", "nome", "unidade"] },
        { model: Usuario, as: "funcionario", attributes: ["id", "nome"] },
        { model: Usuario, as: "enviadoPor", attributes: ["id", "nome"] },
      ],
      order: [["dataEnvio", "DESC"]],
    });

    res.json(envios);
  } catch (error) {
    console.error("Erro ao listar envios de peça:", error);
    res.status(500).json({ error: "Erro ao listar envios de peça" });
  }
};

export const listarEstoquePecasFuncionario = async (req, res) => {
  try {
    const where = {};

    if (req.usuario.role === "FUNCIONARIO") {
      where.funcionarioId = req.usuario.id;
    } else if (req.query.funcionarioId) {
      where.funcionarioId = req.query.funcionarioId;
    }

    const estoques = await EstoquePecaFuncionario.findAll({
      where,
      include: [
        { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
        { model: Usuario, as: "funcionario", attributes: ["id", "nome"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    res.json(estoques);
  } catch (error) {
    console.error("Erro ao listar estoque de peças por funcionário:", error);
    res
      .status(500)
      .json({ error: "Erro ao listar estoque de peças por funcionário" });
  }
};
