import express from "express";
import {
  atualizarInsumo,
  criarCompraInsumo,
  criarInsumo,
  deletarInsumo,
  listarComprasInsumo,
  listarInsumos,
} from "../controllers/insumoController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarInsumos);
router.get("/compras", listarComprasInsumo);
router.post(
  "/",
  requireAdmin,
  registrarLog("CRIAR_INSUMO", "Insumo"),
  criarInsumo,
);
router.put(
  "/:id",
  requireAdmin,
  registrarLog("EDITAR_INSUMO", "Insumo"),
  atualizarInsumo,
);
router.delete(
  "/:id",
  requireAdmin,
  registrarLog("EXCLUIR_INSUMO", "Insumo"),
  deletarInsumo,
);
router.post(
  "/:id/compras",
  requireAdmin,
  registrarLog("REGISTRAR_COMPRA_INSUMO", "InsumoCompra"),
  criarCompraInsumo,
);

export default router;
