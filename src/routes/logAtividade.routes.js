import express from "express";
import { listarLogsAtividade } from "../controllers/logAtividadeController.js";
import { autenticar, requireAdminOuCadastro } from "../middlewares/auth.js";

const router = express.Router();

// Mesmos perfis da tela Análise de Estoque, única que consome os logs.
router.get("/", autenticar, requireAdminOuCadastro, listarLogsAtividade);

export default router;
