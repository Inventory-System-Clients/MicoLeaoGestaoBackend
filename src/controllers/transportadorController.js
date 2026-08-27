import { Transportador } from "../models/index.js";

export const listarTransportadores = async (req, res) => {
  try {
    const transportadores = await Transportador.findAll({
      where: { ativo: true },
      order: [["nome", "ASC"]],
    });
    res.json(transportadores);
  } catch (error) {
    console.error("Erro ao listar transportadores:", error);
    res.status(500).json({ error: "Erro ao listar transportadores" });
  }
};

export const criarTransportador = async (req, res) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    if (!nome) {
      return res.status(400).json({ error: "Nome do transportador é obrigatório" });
    }

    const existente = await Transportador.findOne({
      where: { nome },
    });
    if (existente) {
      if (!existente.ativo) {
        await existente.update({ ativo: true });
      }
      return res.status(200).json(existente);
    }

    const transportador = await Transportador.create({ nome });
    res.status(201).json(transportador);
  } catch (error) {
    console.error("Erro ao criar transportador:", error);
    res.status(500).json({ error: "Erro ao criar transportador" });
  }
};

export const atualizarTransportador = async (req, res) => {
  try {
    const transportador = await Transportador.findByPk(req.params.id);
    if (!transportador) {
      return res.status(404).json({ error: "Transportador não encontrado" });
    }

    const { nome, ativo } = req.body;
    await transportador.update({
      nome: nome !== undefined ? String(nome).trim() : transportador.nome,
      ativo: ativo ?? transportador.ativo,
    });

    res.json(transportador);
  } catch (error) {
    console.error("Erro ao atualizar transportador:", error);
    res.status(500).json({ error: "Erro ao atualizar transportador" });
  }
};

export default {
  listarTransportadores,
  criarTransportador,
  atualizarTransportador,
};
