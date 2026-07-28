import { ModoSeguranca } from "../models/index.js";

export const obterModoSeguranca = async () => {
  const [registro] = await ModoSeguranca.findOrCreate({
    where: { id: 1 },
    defaults: { id: 1, ativo: false },
  });
  return registro;
};

export const bloquearSeModoSegurancaAtivo = async (req, res, next) => {
  try {
    if (req.path.startsWith("/modo-seguranca")) return next();

    const modo = await obterModoSeguranca();
    if (!modo.ativo) return next();

    return res.status(423).json({
      error: "Sistema em modo de seguranca. Acesso temporariamente bloqueado.",
      modoSeguranca: true,
    });
  } catch (error) {
    console.error("Erro ao verificar modo de seguranca:", error);
    return res.status(500).json({ error: "Erro ao verificar modo de seguranca" });
  }
};
