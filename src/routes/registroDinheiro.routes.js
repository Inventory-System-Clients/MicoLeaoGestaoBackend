import express from "express";
import registroDinheiroController from "../controllers/registroDinheiroController.js";
import { autenticar, requireAdmin } from "../middlewares/auth.js";
const router = express.Router();

router.use(autenticar);

// GET /registro-dinheiro/valor-esperado — usado por qualquer funcionário
// enquanto está contando o dinheiro, pra ver a divergência em tempo real.
router.get("/valor-esperado", registroDinheiroController.valorEsperado);

// POST /registro-dinheiro — registrar uma contagem é tarefa operacional de
// qualquer funcionário, não é "ver financeiro".
router.post("/", registroDinheiroController.criar);

// GET /registro-dinheiro — listar o histórico financeiro é só pra
// ADMIN/DESENVOLVEDOR.
router.get("/", requireAdmin, registroDinheiroController.listar);

export default router;
