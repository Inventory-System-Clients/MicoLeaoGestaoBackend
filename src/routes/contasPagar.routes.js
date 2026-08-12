import express from "express";
import {
  atualizarConta,
  criarContaAvulsa,
  excluirConta,
  listarContasPagar,
  marcarComoPaga,
} from "../controllers/contaPagarController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, autorizarRole("ADMIN"));

router.get("/", listarContasPagar);
router.post("/", registrarLog("CRIAR_CONTA_PAGAR", "ContaPagar"), criarContaAvulsa);
router.put("/:id", registrarLog("EDITAR_CONTA_PAGAR", "ContaPagar"), atualizarConta);
router.patch(
  "/:id/pagar",
  registrarLog("PAGAR_CONTA_PAGAR", "ContaPagar"),
  marcarComoPaga,
);
router.delete(
  "/:id",
  registrarLog("EXCLUIR_CONTA_PAGAR", "ContaPagar"),
  excluirConta,
);

export default router;
