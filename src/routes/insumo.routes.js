import express from "express";
import {
  atualizarInsumo,
  criarCompraInsumo,
  criarInsumo,
  deletarInsumo,
  listarComprasInsumo,
  listarInsumos,
} from "../controllers/insumoController.js";
import { autenticar, registrarLog, requireAdminCadastroOuFabrica } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarInsumos);
router.get("/compras", listarComprasInsumo);
router.post(
  "/",
  requireAdminCadastroOuFabrica,
  registrarLog("CRIAR_INSUMO", "Insumo"),
  criarInsumo,
);
router.put(
  "/:id",
  requireAdminCadastroOuFabrica,
  registrarLog("EDITAR_INSUMO", "Insumo"),
  atualizarInsumo,
);
router.delete(
  "/:id",
  requireAdminCadastroOuFabrica,
  registrarLog("EXCLUIR_INSUMO", "Insumo"),
  deletarInsumo,
);
router.post(
  "/:id/compras",
  requireAdminCadastroOuFabrica,
  registrarLog("REGISTRAR_COMPRA_INSUMO", "InsumoCompra"),
  criarCompraInsumo,
);

export default router;
