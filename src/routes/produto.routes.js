import express from "express";
import {
  listarProdutos,
  obterProduto,
  criarProduto,
  atualizarProduto,
  deletarProduto,
  listarCategorias,
} from "../controllers/produtoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarProdutos);
router.get("/categorias", autenticar, listarCategorias);
router.get("/:id", autenticar, obterProduto);
router.post(
  "/",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("CRIAR_PRODUTO", "Produto"),
  criarProduto
);
router.put(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("EDITAR_PRODUTO", "Produto"),
  atualizarProduto
);
router.delete(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("DELETAR_PRODUTO", "Produto"),
  deletarProduto
);

export default router;
