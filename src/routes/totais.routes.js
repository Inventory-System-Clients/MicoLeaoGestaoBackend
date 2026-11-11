import express from "express";
import { totaisDinheiroPix } from "../controllers/totaisController.js";
import { autenticar, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// GET /totais/dinheiro-pix?lojaId=...&dataInicio=...&dataFim=...
// Só Admin (nenhuma tela de outro perfil usa; dá pra liberar por usuário)
router.get("/dinheiro-pix", autenticar, requireAdmin, totaisDinheiroPix);

export default router;
