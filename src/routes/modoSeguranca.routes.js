import express from "express";
import {
  ativarModoSeguranca,
  desativarModoSeguranca,
  statusModoSeguranca,
} from "../controllers/modoSegurancaController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", statusModoSeguranca);
router.post(
  "/ativar",
  autenticar,
  autorizarRole("ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"),
  ativarModoSeguranca,
);
router.post("/desativar", desativarModoSeguranca);

export default router;
