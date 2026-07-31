import express from "express";
import registroDinheiroController from "../controllers/registroDinheiroController.js";
import { autenticar, requireAdmin } from "../middlewares/auth.js";
const router = express.Router();

router.use(autenticar);

// GET /registro-dinheiro/valor-esperado — usado por qualquer funcionário
// enquanto está contando o dinheiro, pra ver a divergência em tempo real.
router.get("/valor-esperado", registroDinheiroController.valorEsperado);

// GET /registro-dinheiro/ultimo-fechamento — pré-preenche a data de início
// do próximo fechamento com o fim do último já registrado pra essa
// máquina/loja.
router.get("/ultimo-fechamento", registroDinheiroController.ultimoFechamento);

// POST /registro-dinheiro — registrar uma contagem é tarefa operacional de
// qualquer funcionário, não é "ver financeiro".
router.post("/", registroDinheiroController.criar);

// GET /registro-dinheiro — listar o histórico financeiro é só pra
// ADMIN/DESENVOLVEDOR.
router.get("/", requireAdmin, registroDinheiroController.listar);

export default router;
