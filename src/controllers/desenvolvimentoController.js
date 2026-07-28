import { DesenvolvimentoSugestao, Usuario } from "../models/index.js";

const STATUS = {
  PENDENTE: "PENDENTE",
  ACEITO: "ACEITO",
  RECUSADO: "RECUSADO",
  DESENVOLVIMENTO: "DESENVOLVIMENTO",
  PRONTO: "PRONTO",
  BAIXADO: "BAIXADO",
};

const includeUsuarios = [
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome", "email", "role"] },
  { model: Usuario, as: "respondidoPor", attributes: ["id", "nome", "email", "role"] },
  { model: Usuario, as: "desenvolvidoPor", attributes: ["id", "nome", "email", "role"] },
  { model: Usuario, as: "baixadoPor", attributes: ["id", "nome", "email", "role"] },
];

const isDev = (usuario) => usuario?.role === "DESENVOLVEDOR";

export const listarSugestoesDesenvolvimento = async (req, res) => {
  try {
    const sugestoes = await DesenvolvimentoSugestao.findAll({
      include: includeUsuarios,
      order: [["updatedAt", "DESC"]],
    });
    res.json(sugestoes);
  } catch (error) {
    console.error("Erro ao listar sugestoes:", error);
    res.status(500).json({ error: "Erro ao listar sugestoes" });
  }
};

export const criarSugestaoDesenvolvimento = async (req, res) => {
  try {
    const titulo = String(req.body.titulo || "").trim();
    const descricao = String(req.body.descricao || "").trim();
    if (!titulo || !descricao) {
      return res.status(400).json({ error: "Titulo e descricao sao obrigatorios" });
    }

    const sugestao = await DesenvolvimentoSugestao.create({
      titulo,
      descricao,
      criadoPorId: req.usuario.id,
    });
    const completa = await DesenvolvimentoSugestao.findByPk(sugestao.id, {
      include: includeUsuarios,
    });
    res.status(201).json(completa);
  } catch (error) {
    console.error("Erro ao criar sugestao:", error);
    res.status(500).json({ error: "Erro ao criar sugestao" });
  }
};

export const responderSugestaoDesenvolvimento = async (req, res) => {
  try {
    const sugestao = await DesenvolvimentoSugestao.findByPk(req.params.id);
    if (!sugestao) return res.status(404).json({ error: "Sugestao nao encontrada" });

    const acao = String(req.body.acao || "").toUpperCase();
    const resposta = String(req.body.resposta || "").trim();
    if (!["ACEITAR", "RECUSAR"].includes(acao)) {
      return res.status(400).json({ error: "Acao invalida" });
    }
    if (acao === "RECUSAR" && !resposta) {
      return res.status(400).json({ error: "Informe o motivo para nao aceitar" });
    }

    await sugestao.update({
      status: acao === "ACEITAR" ? STATUS.ACEITO : STATUS.RECUSADO,
      resposta: resposta || null,
      respondidoPorId: req.usuario.id,
    });

    res.json(await DesenvolvimentoSugestao.findByPk(sugestao.id, { include: includeUsuarios }));
  } catch (error) {
    console.error("Erro ao responder sugestao:", error);
    res.status(500).json({ error: "Erro ao responder sugestao" });
  }
};

export const solicitarRevisaoSugestao = async (req, res) => {
  try {
    const sugestao = await DesenvolvimentoSugestao.findByPk(req.params.id);
    if (!sugestao) return res.status(404).json({ error: "Sugestao nao encontrada" });

    const motivoRevisao = String(req.body.motivoRevisao || "").trim();
    if (!motivoRevisao) {
      return res.status(400).json({ error: "Informe o motivo do que precisa de novo" });
    }

    await sugestao.update({
      status: STATUS.PENDENTE,
      motivoRevisao,
      respondidoPorId: req.usuario.id,
    });

    res.json(await DesenvolvimentoSugestao.findByPk(sugestao.id, { include: includeUsuarios }));
  } catch (error) {
    console.error("Erro ao solicitar revisao:", error);
    res.status(500).json({ error: "Erro ao solicitar revisao" });
  }
};

export const moverSugestaoDesenvolvimento = async (req, res) => {
  try {
    if (!isDev(req.usuario)) {
      return res
        .status(403)
        .json({ error: "Apenas desenvolvedor pode mover para desenvolvimento ou pronto" });
    }

    const sugestao = await DesenvolvimentoSugestao.findByPk(req.params.id);
    if (!sugestao) return res.status(404).json({ error: "Sugestao nao encontrada" });

    const status = String(req.body.status || "").toUpperCase();
    if (![STATUS.DESENVOLVIMENTO, STATUS.PRONTO].includes(status)) {
      return res.status(400).json({ error: "Status invalido para desenvolvedor" });
    }
    if (status === STATUS.DESENVOLVIMENTO && sugestao.status !== STATUS.ACEITO) {
      return res.status(400).json({ error: "A sugestao precisa estar aceita" });
    }
    if (status === STATUS.PRONTO && sugestao.status !== STATUS.DESENVOLVIMENTO) {
      return res.status(400).json({ error: "A sugestao precisa estar em desenvolvimento" });
    }

    await sugestao.update({
      status,
      desenvolvidoPorId: req.usuario.id,
    });

    res.json(await DesenvolvimentoSugestao.findByPk(sugestao.id, { include: includeUsuarios }));
  } catch (error) {
    console.error("Erro ao mover sugestao:", error);
    res.status(500).json({ error: "Erro ao mover sugestao" });
  }
};

export const baixarSugestaoDesenvolvimento = async (req, res) => {
  try {
    const sugestao = await DesenvolvimentoSugestao.findByPk(req.params.id);
    if (!sugestao) return res.status(404).json({ error: "Sugestao nao encontrada" });
    if (sugestao.status !== STATUS.PRONTO) {
      return res.status(400).json({ error: "Apenas sugestoes prontas podem receber baixa" });
    }

    await sugestao.update({
      status: STATUS.BAIXADO,
      baixadoPorId: req.usuario.id,
      baixadoEm: new Date(),
    });

    res.json(await DesenvolvimentoSugestao.findByPk(sugestao.id, { include: includeUsuarios }));
  } catch (error) {
    console.error("Erro ao baixar sugestao:", error);
    res.status(500).json({ error: "Erro ao baixar sugestao" });
  }
};
