import { Op } from "sequelize";
import { Loja, Roteiro, RoteiroItem, Usuario, Veiculo } from "../models/index.js";

const includeRoteiro = [
  {
    model: Usuario,
    as: "funcionario",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Veiculo,
    as: "veiculo",
    attributes: ["id", "nome", "modelo", "tipo", "emoji"],
  },
  {
    model: RoteiroItem,
    as: "itens",
    include: [
      {
        model: Loja,
        as: "loja",
        attributes: ["id", "nome", "endereco", "cidade", "estado"],
      },
    ],
  },
];

const ordenarItens = (roteiro) => {
  const json = roteiro.toJSON();
  json.itens = (json.itens || []).sort((a, b) => a.ordem - b.ordem);
  return json;
};

const obterRoteiroCompleto = async (id) => {
  const roteiro = await Roteiro.findByPk(id, { include: includeRoteiro });
  return roteiro ? ordenarItens(roteiro) : null;
};

const usuarioPodeAcessar = (req, roteiro) =>
  req.usuario.role === "ADMIN" || String(roteiro.usuarioId) === String(req.usuario.id);

const normalizarDiasSemana = (todosDias, diasSemana) => {
  if (todosDias) return [];
  if (!Array.isArray(diasSemana)) return [];
  return diasSemana
    .map((dia) => Number.parseInt(dia, 10))
    .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
};

export const listarRoteiros = async (req, res) => {
  try {
    const where =
      req.usuario.role === "ADMIN" ? {} : { usuarioId: req.usuario.id, ativo: true };

    const roteiros = await Roteiro.findAll({
      where,
      include: includeRoteiro,
      order: [
        ["createdAt", "DESC"],
        [{ model: RoteiroItem, as: "itens" }, "ordem", "ASC"],
      ],
    });

    res.json(roteiros.map(ordenarItens));
  } catch (error) {
    console.error("Erro ao listar roteiros:", error);
    res.status(500).json({ error: "Erro ao listar roteiros" });
  }
};

export const criarRoteiro = async (req, res) => {
  try {
    const { nome, usuarioId, veiculoId, todosDias = true, diasSemana = [] } = req.body;

    if (!nome || !usuarioId) {
      return res.status(400).json({ error: "Nome e funcionário são obrigatórios" });
    }

    const funcionario = await Usuario.findByPk(usuarioId);
    if (!funcionario || funcionario.role !== "FUNCIONARIO") {
      return res.status(400).json({ error: "Funcionário inválido" });
    }

    if (veiculoId) {
      const veiculo = await Veiculo.findByPk(veiculoId);
      if (!veiculo) return res.status(400).json({ error: "Veículo inválido" });
    }

    const roteiro = await Roteiro.create({
      nome: nome.trim(),
      usuarioId,
      veiculoId: veiculoId || null,
      todosDias: Boolean(todosDias),
      diasSemana: normalizarDiasSemana(Boolean(todosDias), diasSemana),
    });

    res.locals.entityId = roteiro.id;
    res.status(201).json(await obterRoteiroCompleto(roteiro.id));
  } catch (error) {
    console.error("Erro ao criar roteiro:", error);
    res.status(500).json({ error: "Erro ao criar roteiro" });
  }
};

export const atualizarRoteiro = async (req, res) => {
  try {
    const roteiro = await Roteiro.findByPk(req.params.id);
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });

    const { nome, usuarioId, veiculoId, todosDias, diasSemana, ativo } = req.body;
    const todosDiasFinal = todosDias !== undefined ? Boolean(todosDias) : roteiro.todosDias;

    await roteiro.update({
      nome: nome !== undefined ? String(nome).trim() : roteiro.nome,
      usuarioId: usuarioId ?? roteiro.usuarioId,
      veiculoId: veiculoId === "" ? null : veiculoId ?? roteiro.veiculoId,
      todosDias: todosDiasFinal,
      diasSemana:
        diasSemana !== undefined
          ? normalizarDiasSemana(todosDiasFinal, diasSemana)
          : roteiro.diasSemana,
      ativo: ativo ?? roteiro.ativo,
    });

    res.json(await obterRoteiroCompleto(roteiro.id));
  } catch (error) {
    console.error("Erro ao atualizar roteiro:", error);
    res.status(500).json({ error: "Erro ao atualizar roteiro" });
  }
};

export const excluirRoteiro = async (req, res) => {
  try {
    const roteiro = await Roteiro.findByPk(req.params.id);
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });

    await roteiro.destroy();
    res.json({ message: "Roteiro removido com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir roteiro:", error);
    res.status(500).json({ error: "Erro ao excluir roteiro" });
  }
};

export const criarItemRoteiro = async (req, res) => {
  try {
    const { roteiroId } = req.params;
    const { tipo, lojaId, anotacao, ordem } = req.body;
    const roteiro = await Roteiro.findByPk(roteiroId);

    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });
    if (!usuarioPodeAcessar(req, roteiro)) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    const tipoFinal = tipo === "ANOTACAO" ? "ANOTACAO" : "LOJA";
    if (tipoFinal === "LOJA" && !lojaId) {
      return res.status(400).json({ error: "Selecione uma loja" });
    }
    if (tipoFinal === "ANOTACAO" && !String(anotacao || "").trim()) {
      return res.status(400).json({ error: "Informe a anotação" });
    }

    const totalItens = await RoteiroItem.count({ where: { roteiroId } });
    const item = await RoteiroItem.create({
      roteiroId,
      tipo: tipoFinal,
      lojaId: tipoFinal === "LOJA" ? lojaId : null,
      anotacao: tipoFinal === "ANOTACAO" ? String(anotacao).trim() : anotacao || null,
      ordem: ordem ?? totalItens,
    });

    res.locals.entityId = item.id;
    res.status(201).json(await obterRoteiroCompleto(roteiroId));
  } catch (error) {
    console.error("Erro ao criar item do roteiro:", error);
    res.status(500).json({ error: "Erro ao criar item do roteiro" });
  }
};

export const atualizarItemRoteiro = async (req, res) => {
  try {
    const item = await RoteiroItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    const roteirosIds = [item.roteiroId, req.body.roteiroId].filter(Boolean);
    const roteiros = await Roteiro.findAll({ where: { id: { [Op.in]: roteirosIds } } });
    if (roteiros.some((roteiro) => !usuarioPodeAcessar(req, roteiro))) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    await item.update({
      roteiroId: req.body.roteiroId ?? item.roteiroId,
      ordem: req.body.ordem ?? item.ordem,
      lojaId: req.body.lojaId !== undefined ? req.body.lojaId : item.lojaId,
      anotacao:
        req.body.anotacao !== undefined ? String(req.body.anotacao).trim() : item.anotacao,
    });

    res.json(await obterRoteiroCompleto(item.roteiroId));
  } catch (error) {
    console.error("Erro ao atualizar item do roteiro:", error);
    res.status(500).json({ error: "Erro ao atualizar item do roteiro" });
  }
};

export const excluirItemRoteiro = async (req, res) => {
  try {
    const item = await RoteiroItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    const roteiroId = item.roteiroId;
    const roteiro = await Roteiro.findByPk(roteiroId);
    if (!usuarioPodeAcessar(req, roteiro)) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    await item.destroy();
    res.json(await obterRoteiroCompleto(roteiroId));
  } catch (error) {
    console.error("Erro ao excluir item do roteiro:", error);
    res.status(500).json({ error: "Erro ao excluir item do roteiro" });
  }
};
