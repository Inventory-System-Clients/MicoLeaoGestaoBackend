import express from "express";
import {
  atualizarInsumo,
  criarCompraInsumo,
  criarInsumo,
  deletarInsumo,
  listarComprasInsumo,
  listarInsumos,
} from "../controllers/insumoController.js";
import { autenticar, registrarLog, requireAdminCadastroOuEstoque } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarInsumos);
router.get("/compras", listarComprasInsumo);
router.post(
  "/",
  requireAdminCadastroOuEstoque,
  registrarLog("CRIAR_INSUMO", "Insumo"),
  criarInsumo,
);
router.put(
  "/:id",
  requireAdminCadastroOuEstoque,
  registrarLog("EDITAR_INSUMO", "Insumo"),
  atualizarInsumo,
);
router.delete(
  "/:id",
  requireAdminCadastroOuEstoque,
  registrarLog("EXCLUIR_INSUMO", "Insumo"),
  deletarInsumo,
);
router.post(
  "/:id/compras",
  requireAdminCadastroOuEstoque,
  registrarLog("REGISTRAR_COMPRA_INSUMO", "InsumoCompra"),
  criarCompraInsumo,
);

export default router;
