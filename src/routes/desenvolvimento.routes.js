import express from "express";
import {
  baixarSugestaoDesenvolvimento,
  criarSugestaoDesenvolvimento,
  listarSugestoesDesenvolvimento,
  moverSugestaoDesenvolvimento,
  responderSugestaoDesenvolvimento,
  solicitarRevisaoSugestao,
} from "../controllers/desenvolvimentoController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, autorizarRole("ADMIN", "DESENVOLVEDOR"));

router.get("/", listarSugestoesDesenvolvimento);
router.post(
  "/",
  registrarLog("CRIAR_SUGESTAO_DESENVOLVIMENTO", "DesenvolvimentoSugestao"),
  criarSugestaoDesenvolvimento,
);
router.patch(
  "/:id/responder",
  registrarLog("RESPONDER_SUGESTAO_DESENVOLVIMENTO", "DesenvolvimentoSugestao"),
  responderSugestaoDesenvolvimento,
);
router.patch(
  "/:id/revisao",
  registrarLog("SOLICITAR_REVISAO_DESENVOLVIMENTO", "DesenvolvimentoSugestao"),
  solicitarRevisaoSugestao,
);
router.patch(
  "/:id/mover",
  registrarLog("MOVER_SUGESTAO_DESENVOLVIMENTO", "DesenvolvimentoSugestao"),
  moverSugestaoDesenvolvimento,
);
router.patch(
  "/:id/baixar",
  registrarLog("BAIXAR_SUGESTAO_DESENVOLVIMENTO", "DesenvolvimentoSugestao"),
  baixarSugestaoDesenvolvimento,
);

export default router;
