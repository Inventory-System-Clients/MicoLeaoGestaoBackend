import express from "express";
import {
  listarShoppings,
  obterShopping,
  criarShopping,
  atualizarShopping,
  deletarShopping,
} from "../controllers/shoppingController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

// Mesmo acesso de Lojas: todos veem; Admin e Cadastro mexem
const router = express.Router();

router.get("/", autenticar, listarShoppings);
router.get("/:id", autenticar, obterShopping);
router.post(
  "/",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("CRIAR_SHOPPING", "Shopping"),
  criarShopping,
);
router.put(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("EDITAR_SHOPPING", "Shopping"),
  atualizarShopping,
);
router.delete(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("DELETAR_SHOPPING", "Shopping"),
  deletarShopping,
);

export default router;
