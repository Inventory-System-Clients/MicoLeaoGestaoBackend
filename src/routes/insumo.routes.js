import express from "express";
import {
  atualizarInsumo,
  criarCompraInsumo,
  criarInsumo,
  deletarInsumo,
  listarComprasInsumo,
  listarInsumos,
} from "../controllers/insumoController.js";
import { autenticar, registrarLog, requireAdminOuCadastro } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarInsumos);
router.get("/compras", listarComprasInsumo);
router.post(
  "/",
  requireAdminOuCadastro,
  registrarLog("CRIAR_INSUMO", "Insumo"),
  criarInsumo,
);
router.put(
  "/:id",
  requireAdminOuCadastro,
  registrarLog("EDITAR_INSUMO", "Insumo"),
  atualizarInsumo,
);
router.delete(
  "/:id",
  requireAdminOuCadastro,
  registrarLog("EXCLUIR_INSUMO", "Insumo"),
  deletarInsumo,
);
router.post(
  "/:id/compras",
  requireAdminOuCadastro,
  registrarLog("REGISTRAR_COMPRA_INSUMO", "InsumoCompra"),
  criarCompraInsumo,
);

export default router;
