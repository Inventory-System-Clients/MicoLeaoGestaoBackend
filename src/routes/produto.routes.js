import express from "express";
import {
  listarProdutos,
  obterProduto,
  criarProduto,
  atualizarProduto,
  deletarProduto,
  listarCategorias,
  listarCadastroCategorias,
  criarCategoria,
  renomearCategoria,
  excluirCategoria,
} from "../controllers/produtoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarProdutos);
router.get("/categorias", autenticar, listarCategorias);
// Cadastro de categorias (botão na tela de Produtos)
router.get("/categorias/cadastro", autenticar, autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"), listarCadastroCategorias);
router.post("/categorias", autenticar, autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"), criarCategoria);
router.put("/categorias/:id", autenticar, autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"), renomearCategoria);
router.delete("/categorias/:id", autenticar, autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"), excluirCategoria);
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
