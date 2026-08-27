import { TipoMaquina } from "../models/index.js";

export const listarTiposMaquina = async (req, res) => {
  try {
    const { incluirInativos } = req.query;
    const where = {};

    if (incluirInativos !== "true") {
      where.ativo = true;
    }

    const tipos = await TipoMaquina.findAll({
      where,
      order: [["nome", "ASC"]],
    });

    res.json(tipos);
  } catch (error) {
    console.error("Erro ao listar tipos de máquina:", error);
    res.status(500).json({ error: "Erro ao listar tipos de máquina" });
  }
};

export const criarTipoMaquina = async (req, res) => {
  try {
    const { nome, capacidadePadrao } = req.body;

    if (!nome || !nome.trim()) {
      return res
        .status(400)
        .json({ error: "Nome do tipo de máquina é obrigatório" });
    }

    const existente = await TipoMaquina.findOne({
      where: { nome: nome.trim() },
    });
    if (existente) {
      return res
        .status(400)
        .json({ error: "Já existe um tipo de máquina com esse nome" });
    }

    const tipo = await TipoMaquina.create({
      nome: nome.trim(),
      capacidadePadrao:
        capacidadePadrao !== undefined && capacidadePadrao !== null && capacidadePadrao !== ""
          ? Number(capacidadePadrao)
          : 100,
    });

    res.locals.entityId = tipo.id;
    res.status(201).json(tipo);
  } catch (error) {
    console.error("Erro ao criar tipo de máquina:", error);
    res.status(500).json({ error: "Erro ao criar tipo de máquina" });
  }
};

export const atualizarTipoMaquina = async (req, res) => {
  try {
    const tipo = await TipoMaquina.findByPk(req.params.id);

    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina não encontrado" });
    }

    const { nome, capacidadePadrao, ativo } = req.body;

    if (nome && nome.trim() !== tipo.nome) {
      const existente = await TipoMaquina.findOne({
        where: { nome: nome.trim() },
      });
      if (existente) {
        return res
          .status(400)
          .json({ error: "Já existe um tipo de máquina com esse nome" });
      }
    }

    await tipo.update({
      nome: nome !== undefined ? nome.trim() : tipo.nome,
      capacidadePadrao:
        capacidadePadrao !== undefined && capacidadePadrao !== null && capacidadePadrao !== ""
          ? Number(capacidadePadrao)
          : tipo.capacidadePadrao,
      ativo: ativo ?? tipo.ativo,
    });

    res.locals.entityId = tipo.id;
    res.json(tipo);
  } catch (error) {
    console.error("Erro ao atualizar tipo de máquina:", error);
    res.status(500).json({ error: "Erro ao atualizar tipo de máquina" });
  }
};

export const deletarTipoMaquina = async (req, res) => {
  try {
    const tipo = await TipoMaquina.findByPk(req.params.id);

    if (!tipo) {
      return res.status(404).json({ error: "Tipo de máquina não encontrado" });
    }

    if (!tipo.ativo) {
      await tipo.destroy();
      res.locals.entityId = req.params.id;
      return res.json({
        message: "Tipo de máquina excluído permanentemente com sucesso",
        permanentDelete: true,
      });
    }

    await tipo.update({ ativo: false });
    res.locals.entityId = tipo.id;
    res.json({
      message:
        "Tipo de máquina desativado com sucesso. Clique novamente para excluir permanentemente.",
      permanentDelete: false,
    });
  } catch (error) {
    console.error("Erro ao excluir tipo de máquina:", error);
    res.status(500).json({ error: "Erro ao excluir tipo de máquina" });
  }
};

export default {
  listarTiposMaquina,
  criarTipoMaquina,
  atualizarTipoMaquina,
  deletarTipoMaquina,
};
