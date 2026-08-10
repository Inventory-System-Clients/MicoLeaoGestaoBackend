import express from "express";
import {
  criarPedidoPelucia,
  darBaixaPedidoPelucia,
  listarPedidosPelucia,
} from "../controllers/pedidoPeluciaController.js";
import { autenticar, registrarLog, requireAdminCadastroOuFabrica } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarPedidosPelucia);
router.post(
  "/",
  requireAdminCadastroOuFabrica,
  registrarLog("CRIAR_PEDIDO_PELUCIA", "PedidoPelucia"),
  criarPedidoPelucia,
);
router.patch(
  "/:id/baixa",
  requireAdminCadastroOuFabrica,
  registrarLog("BAIXA_PEDIDO_PELUCIA", "PedidoPelucia"),
  darBaixaPedidoPelucia,
);

export default router;
