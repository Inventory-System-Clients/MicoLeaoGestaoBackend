import express from "express";
import projetoLojaController from "../controllers/projetoLojaController.js";
import { documentosDe } from "../controllers/documentoController.js";
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
router.post("/:id/concluir", projetoLojaController.concluir);
router.delete("/:id", projetoLojaController.excluir);

// Documentos em PDF do projeto
const documentosProjeto = documentosDe("PROJETO_LOJA");
router.get("/:id/documentos", documentosProjeto.listar);
router.post("/:id/documentos", documentosProjeto.criar);
router.delete("/:id/documentos/:documentoId", documentosProjeto.excluir);

export default router;
