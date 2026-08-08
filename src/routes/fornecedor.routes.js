import express from "express";
import {
  atualizarFornecedor,
  compararPrecosFornecedores,
  criarFornecedor,
  excluirFornecedor,
  listarFornecedores,
} from "../controllers/fornecedorController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarFornecedores);
router.get("/comparacoes", autenticar, compararPrecosFornecedores);
router.post(
  "/",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
  registrarLog("CRIAR_FORNECEDOR", "Fornecedor"),
  criarFornecedor,
);
router.put(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
  registrarLog("EDITAR_FORNECEDOR", "Fornecedor"),
  atualizarFornecedor,
);
router.delete(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
  registrarLog("EXCLUIR_FORNECEDOR", "Fornecedor"),
  excluirFornecedor,
);

export default router;
