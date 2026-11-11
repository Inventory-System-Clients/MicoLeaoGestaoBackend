import express from "express";
import metaController from "../controllers/metaController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

// Funcionário: só a porcentagem das lojas em que tem comissão
router.get("/minhas", autenticar, metaController.minhas);

// Admin (e Financeiro, pelo padrão do perfil)
const gestao = [autenticar, autorizarRole("ADMIN")];
router.get("/", ...gestao, metaController.listar);
router.put("/", ...gestao, metaController.salvar);
router.post("/copiar-mes-anterior", ...gestao, metaController.copiarMesAnterior);
router.get("/lancamentos", ...gestao, metaController.listarLancamentos);
router.post("/lancamentos", ...gestao, metaController.lancar);
router.delete("/lancamentos/:id", ...gestao, metaController.excluirLancamento);
router.delete("/:id", ...gestao, metaController.excluir);

export default router;
