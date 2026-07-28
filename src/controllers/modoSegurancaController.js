import { ModoSeguranca, Usuario, LogAtividade } from "../models/index.js";
import { obterModoSeguranca } from "../middlewares/modoSeguranca.js";

const senhaModoSeguranca = process.env.MODO_SEGURANCA_SENHA || "2468";

const validarSenha = (senha) => String(senha || "") === senhaModoSeguranca;

const buscarCompleto = async () =>
  ModoSeguranca.findByPk(1, {
    include: [
      { model: Usuario, as: "ativadoPor", attributes: ["id", "nome", "email", "role"] },
      { model: Usuario, as: "desativadoPor", attributes: ["id", "nome", "email", "role"] },
    ],
  });

export const statusModoSeguranca = async (req, res) => {
  try {
    await obterModoSeguranca();
    res.json(await buscarCompleto());
  } catch (error) {
    console.error("Erro ao obter modo de seguranca:", error);
    res.status(500).json({ error: "Erro ao obter modo de seguranca" });
  }
};

export const ativarModoSeguranca = async (req, res) => {
  try {
    if (!validarSenha(req.body.senha)) {
      return res.status(400).json({ error: "Senha de seguranca invalida" });
    }

    const modo = await obterModoSeguranca();
    await modo.update({
      ativo: true,
      motivo: String(req.body.motivo || "").trim() || null,
      ativadoPorId: req.usuario.id,
      ativadoEm: new Date(),
      desativadoPorId: null,
      desativadoEm: null,
    });

    await LogAtividade.create({
      usuarioId: req.usuario.id,
      acao: "ATIVAR_MODO_SEGURANCA",
      entidade: "ModoSeguranca",
      entidadeId: null,
      detalhes: { modoSegurancaId: modo.id, motivo: modo.motivo },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("user-agent"),
    });

    res.json(await buscarCompleto());
  } catch (error) {
    console.error("Erro ao ativar modo de seguranca:", error);
    res.status(500).json({ error: "Erro ao ativar modo de seguranca" });
  }
};

export const desativarModoSeguranca = async (req, res) => {
  try {
    if (!validarSenha(req.body.senha)) {
      return res.status(400).json({ error: "Senha de seguranca invalida" });
    }

    const modo = await obterModoSeguranca();
    await modo.update({
      ativo: false,
      desativadoPorId: req.usuario?.id || null,
      desativadoEm: new Date(),
    });

    if (req.usuario?.id) {
      await LogAtividade.create({
        usuarioId: req.usuario.id,
        acao: "DESATIVAR_MODO_SEGURANCA",
        entidade: "ModoSeguranca",
        entidadeId: null,
        detalhes: { modoSegurancaId: modo.id },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get("user-agent"),
      });
    }

    res.json(await buscarCompleto());
  } catch (error) {
    console.error("Erro ao desativar modo de seguranca:", error);
    res.status(500).json({ error: "Erro ao desativar modo de seguranca" });
  }
};
