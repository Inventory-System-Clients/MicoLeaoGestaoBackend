import { Op } from "sequelize";
import { TreinamentoFeedback, TreinamentoVideo, Usuario } from "../models/index.js";

const tiposUsuarioValidos = ["TODOS", "ADMIN", "FUNCIONARIO"];

const normalizarVideo = (body) => {
  const titulo = String(body.titulo || "").trim();
  const categoria = String(body.categoria || "Geral").trim() || "Geral";
  const link = String(body.link || "").trim();
  const descricao = String(body.descricao || "").trim() || null;
  const tipoUsuario = String(body.tipoUsuario || "TODOS").toUpperCase();
  const ativo = body.ativo !== undefined ? Boolean(body.ativo) : true;

  if (!titulo) throw new Error("Titulo e obrigatorio");
  if (!link) throw new Error("Link e obrigatorio");
  if (!tiposUsuarioValidos.includes(tipoUsuario)) {
    throw new Error("Tipo de usuario invalido");
  }

  return { titulo, categoria, link, descricao, tipoUsuario, ativo };
};

export const listarVideosTreinamento = async (req, res) => {
  try {
    const where =
      ["ADMIN", "DESENVOLVEDOR"].includes(req.usuario.role)
        ? {}
        : {
            ativo: true,
            tipoUsuario: { [Op.in]: ["TODOS", req.usuario.role] },
          };

    const videos = await TreinamentoVideo.findAll({
      where,
      order: [
        ["categoria", "ASC"],
        ["titulo", "ASC"],
      ],
    });

    res.json(videos);
  } catch (error) {
    console.error("Erro ao listar treinamentos:", error);
    res.status(500).json({ error: "Erro ao listar treinamentos" });
  }
};

export const criarVideoTreinamento = async (req, res) => {
  try {
    const dados = normalizarVideo(req.body);
    const video = await TreinamentoVideo.create({
      ...dados,
      criadoPorId: req.usuario.id,
    });
    res.status(201).json(video);
  } catch (error) {
    if (error.message.includes("obrigatorio") || error.message.includes("invalido")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao criar treinamento:", error);
    res.status(500).json({ error: "Erro ao criar treinamento" });
  }
};

export const atualizarVideoTreinamento = async (req, res) => {
  try {
    const video = await TreinamentoVideo.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: "Treinamento nao encontrado" });

    await video.update(normalizarVideo({ ...video.toJSON(), ...req.body }));
    res.json(video);
  } catch (error) {
    if (error.message.includes("obrigatorio") || error.message.includes("invalido")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao atualizar treinamento:", error);
    res.status(500).json({ error: "Erro ao atualizar treinamento" });
  }
};

export const excluirVideoTreinamento = async (req, res) => {
  try {
    const video = await TreinamentoVideo.findByPk(req.params.id);
    if (!video) return res.status(404).json({ error: "Treinamento nao encontrado" });

    await video.destroy();
    res.json({ message: "Treinamento removido" });
  } catch (error) {
    console.error("Erro ao remover treinamento:", error);
    res.status(500).json({ error: "Erro ao remover treinamento" });
  }
};

export const criarFeedbackTreinamento = async (req, res) => {
  try {
    const mensagem = String(req.body.mensagem || "").trim();
    const tipo = String(req.body.tipo || "OBSERVACAO").toUpperCase();

    if (!mensagem) {
      return res.status(400).json({ error: "Mensagem e obrigatoria" });
    }

    const feedback = await TreinamentoFeedback.create({
      usuarioId: req.usuario.id,
      mensagem,
      tipo,
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error("Erro ao enviar mensagem de treinamento:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
};

export const listarFeedbacksTreinamento = async (req, res) => {
  try {
    const feedbacks = await TreinamentoFeedback.findAll({
      include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome", "email", "role"] }],
      order: [["createdAt", "DESC"]],
    });

    res.json(feedbacks);
  } catch (error) {
    console.error("Erro ao listar mensagens de treinamento:", error);
    res.status(500).json({ error: "Erro ao listar mensagens" });
  }
};

export const marcarFeedbackVisualizado = async (req, res) => {
  try {
    const feedback = await TreinamentoFeedback.findByPk(req.params.id);
    if (!feedback) return res.status(404).json({ error: "Mensagem nao encontrada" });

    await feedback.update({ visualizado: req.body.visualizado !== false });
    res.json(feedback);
  } catch (error) {
    console.error("Erro ao atualizar mensagem:", error);
    res.status(500).json({ error: "Erro ao atualizar mensagem" });
  }
};
