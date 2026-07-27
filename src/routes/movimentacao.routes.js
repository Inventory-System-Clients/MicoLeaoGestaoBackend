import express from "express";
import {
  registrarMovimentacao,
  listarMovimentacoes,
  obterUltimaMovimentacaoPorMaquina,
  obterMovimentacao,
  atualizarMovimentacao,
  deletarMovimentacao,
} from "../controllers/movimentacaoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarMovimentacoes);
router.get(
  "/maquina/:maquinaId/ultima",
  autenticar,
  obterUltimaMovimentacaoPorMaquina
);
router.get("/:id", autenticar, obterMovimentacao);
router.post(
  "/",
  autenticar,
  registrarLog("REGISTRAR_MOVIMENTACAO", "Movimentacao"),
  registrarMovimentacao
);
router.put(
  "/:id",
  autenticar,
  registrarLog("EDITAR_MOVIMENTACAO", "Movimentacao"),
  atualizarMovimentacao
);
router.delete(
  "/:id",
  autenticar,
  autorizarRole("ADMIN"),
  registrarLog("DELETAR_MOVIMENTACAO", "Movimentacao"),
  deletarMovimentacao
);

export default router;
