import express from "express";
import {
  criarAlertaMovimentacao,
  listarAlertasMovimentacao,
  resolverAlertaMovimentacao,
} from "../controllers/alertaMovimentacaoController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.post("/", criarAlertaMovimentacao);
router.get(
  "/",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  listarAlertasMovimentacao,
);
router.patch(
  "/:id/resolver",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  resolverAlertaMovimentacao,
);

export default router;
