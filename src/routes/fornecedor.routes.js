import express from "express";
import {
  atualizarFornecedor,
  compararPrecosFornecedores,
  criarFornecedor,
  excluirFornecedor,
  listarFornecedores,
} from "../controllers/fornecedorController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarFornecedores);
router.get("/comparacoes", autenticar, compararPrecosFornecedores);
router.post(
  "/",
  autenticar,
  requireAdmin,
  registrarLog("CRIAR_FORNECEDOR", "Fornecedor"),
  criarFornecedor,
);
router.put(
  "/:id",
  autenticar,
  requireAdmin,
  registrarLog("EDITAR_FORNECEDOR", "Fornecedor"),
  atualizarFornecedor,
);
router.delete(
  "/:id",
  autenticar,
  requireAdmin,
  registrarLog("EXCLUIR_FORNECEDOR", "Fornecedor"),
  excluirFornecedor,
);

export default router;
