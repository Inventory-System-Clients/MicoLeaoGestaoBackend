import express from "express";
import {
  criarPedidoPelucia,
  darBaixaPedidoPelucia,
  listarPedidosPelucia,
} from "../controllers/pedidoPeluciaController.js";
import { autenticar, registrarLog, requireAdminCadastroOuEstoque } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarPedidosPelucia);
router.post(
  "/",
  requireAdminCadastroOuEstoque,
  registrarLog("CRIAR_PEDIDO_PELUCIA", "PedidoPelucia"),
  criarPedidoPelucia,
);
router.patch(
  "/:id/baixa",
  requireAdminCadastroOuEstoque,
  registrarLog("BAIXA_PEDIDO_PELUCIA", "PedidoPelucia"),
  darBaixaPedidoPelucia,
);

export default router;
