import { ModoSeguranca, Usuario, LogAtividade } from "../models/index.js";
import { obterModoSeguranca } from "../middlewares/modoSeguranca.js";

const senhaModoSeguranca = process.env.MODO_SEGURANCA_SENHA || "2468";

const validarSenha = (senha) => String(senha || "") === senhaModoSeguranca;

// Desativar não exige login (com o modo ativo nem o login funciona), então
// a senha é a única proteção: limita tentativas erradas por IP para impedir
// força bruta. Fica em memória — reinício do servidor zera os contadores.
const MAX_TENTATIVAS_ERRADAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const tentativasPorIp = new Map();

const obterIp = (req) => req.ip || req.connection.remoteAddress || "desconhecido";

const ipBloqueado = (ip) => {
  const registro = tentativasPorIp.get(ip);
  if (!registro?.bloqueadoAte) return false;
  if (registro.bloqueadoAte > Date.now()) return true;
  tentativasPorIp.delete(ip);
  return false;
};

const registrarTentativaErrada = (ip) => {
  const registro = tentativasPorIp.get(ip) || { falhas: 0, bloqueadoAte: null };
  registro.falhas += 1;
  if (registro.falhas >= MAX_TENTATIVAS_ERRADAS) {
    registro.bloqueadoAte = Date.now() + BLOQUEIO_MS;
  }
  tentativasPorIp.set(ip, registro);
};

// Retorna a resposta de erro já enviada, ou null se a senha estiver certa.
const conferirSenhaComLimite = (req, res) => {
  const ip = obterIp(req);
  if (ipBloqueado(ip)) {
    return res.status(429).json({
      error: "Muitas tentativas com senha errada. Tente novamente em 15 minutos.",
    });
  }
  if (!validarSenha(req.body.senha)) {
    registrarTentativaErrada(ip);
    return res.status(400).json({ error: "Senha de seguranca invalida" });
  }
  tentativasPorIp.delete(ip);
  return null;
};

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
    if (conferirSenhaComLimite(req, res)) return;

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
    if (conferirSenhaComLimite(req, res)) return;

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
