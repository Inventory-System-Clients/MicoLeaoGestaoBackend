import express from "express";
import projetoLojaController from "../controllers/projetoLojaController.js";
import { autenticar, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

// Projetos Loja mostra quanto foi/será investido pra abrir uma loja (custo de
// máquinas + demais gastos de implantação) — é informação financeira, então
// fica restrito a ADMIN/DESENVOLVEDOR, igual Gasto Variável e Registrar
// Dinheiro.
router.use(autenticar, requireAdmin);

router.get("/", projetoLojaController.listar);
router.get("/:id", projetoLojaController.obter);
router.post("/", projetoLojaController.criar);
router.put("/:id", projetoLojaController.atualizar);
router.delete("/:id", projetoLojaController.excluir);

export default router;
