import express from "express";
import {
  criarPedidoPelucia,
  darBaixaPedidoPelucia,
  listarPedidosPelucia,
} from "../controllers/pedidoPeluciaController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarPedidosPelucia);
router.post(
  "/",
  requireAdmin,
  registrarLog("CRIAR_PEDIDO_PELUCIA", "PedidoPelucia"),
  criarPedidoPelucia,
);
router.patch(
  "/:id/baixa",
  requireAdmin,
  registrarLog("BAIXA_PEDIDO_PELUCIA", "PedidoPelucia"),
  darBaixaPedidoPelucia,
);

export default router;
