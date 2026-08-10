import express from "express";
import {
  atualizarCompra,
  atualizarStatusCompra,
  criarCompra,
  deletarCompra,
  historicoPrecos,
  listarCompras,
} from "../controllers/compraController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(
  autenticar,
  autorizarRole(
    "ADMIN",
    "FUNCIONARIO_ESTOQUE",
    "FUNCIONARIO_CADASTRO",
    "FUNCIONARIO_FABRICA",
  ),
);

router.get("/", listarCompras);
router.get("/historico-precos", historicoPrecos);
router.post("/", registrarLog("CRIAR_COMPRA", "Compra"), criarCompra);
router.put("/:id", registrarLog("EDITAR_COMPRA", "Compra"), atualizarCompra);
router.patch(
  "/:id/status",
  registrarLog("ATUALIZAR_STATUS_COMPRA", "Compra"),
  atualizarStatusCompra,
);
router.delete(
  "/:id",
  registrarLog("EXCLUIR_COMPRA", "Compra"),
  deletarCompra,
);

export default router;
