import express from "express";
import tarefaController from "../controllers/tarefaController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

// Relatório de tarefas (Relatórios): admin
router.get("/relatorio", autenticar, autorizarRole("ADMIN"), tarefaController.relatorio);

// Cada um: as tarefas que criou e as que são para ele (o admin vê todas).
// O histórico de cada tarefa já guarda quem fez o quê (o log de atividades
// usa id UUID e a tarefa tem número).
router.get("/", autenticar, tarefaController.listar);
router.get("/opcoes", autenticar, tarefaController.opcoes);
router.post("/", autenticar, tarefaController.criar);
router.put("/:id", autenticar, tarefaController.editar);
router.post("/:id/aceitar", autenticar, tarefaController.aceitar);
router.post("/:id/recusar", autenticar, tarefaController.recusar);
router.post("/:id/feito", autenticar, tarefaController.feito);
router.post("/:id/cancelar", autenticar, tarefaController.cancelar);

export default router;
