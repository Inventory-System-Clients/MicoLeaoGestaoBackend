import { AlertaMovimentacao, Maquina, Loja, Usuario } from "../models/index.js";

export const criarAlertaMovimentacao = async (req, res) => {
  try {
    const { maquinaId, observacao } = req.body;
    const usuarioId = req.usuario?.id;

    if (!maquinaId || !observacao?.trim()) {
      return res
        .status(400)
        .json({ error: "Campos obrigatórios não preenchidos." });
    }

    const maquina = await Maquina.findByPk(maquinaId);
    if (!maquina) {
      return res.status(404).json({ error: "Máquina não encontrada." });
    }

    const alerta = await AlertaMovimentacao.create({
      maquinaId,
      lojaId: maquina.lojaId,
      usuarioId,
      observacao: observacao.trim(),
      status: "PENDENTE",
    });

    res.status(201).json(alerta);
  } catch (error) {
    console.error("Erro ao criar alerta de movimentação:", error);
    res.status(500).json({ error: "Erro ao criar alerta de movimentação." });
  }
};

export const listarAlertasMovimentacao = async (req, res) => {
  try {
    const alertas = await AlertaMovimentacao.findAll({
      where: { status: "PENDENTE" },
      include: [
        { model: Maquina, as: "maquina", attributes: ["id", "nome", "codigo"] },
        { model: Loja, as: "loja", attributes: ["id", "nome"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(alertas);
  } catch (error) {
    console.error("Erro ao listar alertas de movimentação:", error);
    res.status(500).json({ error: "Erro ao listar alertas de movimentação." });
  }
};

export const resolverAlertaMovimentacao = async (req, res) => {
  try {
    const alerta = await AlertaMovimentacao.findByPk(req.params.id);
    if (!alerta) {
      return res
        .status(404)
        .json({ error: "Alerta de movimentação não encontrado." });
    }

    if (alerta.status === "RESOLVIDO") {
      return res.status(400).json({ error: "Este alerta já foi resolvido." });
    }

    await alerta.update({
      status: "RESOLVIDO",
      resolvidoPorId: req.usuario.id,
      resolvidoEm: new Date(),
    });

    res.json(alerta);
  } catch (error) {
    console.error("Erro ao resolver alerta de movimentação:", error);
    res.status(500).json({ error: "Erro ao resolver alerta de movimentação." });
  }
};
