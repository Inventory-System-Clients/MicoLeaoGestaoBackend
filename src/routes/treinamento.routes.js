import express from "express";
import {
  atualizarVideoTreinamento,
  criarFeedbackTreinamento,
  criarVideoTreinamento,
  excluirVideoTreinamento,
  listarFeedbacksTreinamento,
  listarVideosTreinamento,
  marcarFeedbackVisualizado,
} from "../controllers/treinamentoController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.get("/videos", autenticar, listarVideosTreinamento);
router.post(
  "/videos",
  autenticar,
  requireAdmin,
  registrarLog("CRIAR_TREINAMENTO_VIDEO", "TreinamentoVideo"),
  criarVideoTreinamento,
);
router.put(
  "/videos/:id",
  autenticar,
  requireAdmin,
  registrarLog("EDITAR_TREINAMENTO_VIDEO", "TreinamentoVideo"),
  atualizarVideoTreinamento,
);
router.delete(
  "/videos/:id",
  autenticar,
  requireAdmin,
  registrarLog("EXCLUIR_TREINAMENTO_VIDEO", "TreinamentoVideo"),
  excluirVideoTreinamento,
);

router.post("/feedbacks", autenticar, criarFeedbackTreinamento);
router.get("/feedbacks", autenticar, requireAdmin, listarFeedbacksTreinamento);
router.patch(
  "/feedbacks/:id/visualizado",
  autenticar,
  requireAdmin,
  marcarFeedbackVisualizado,
);

export default router;
