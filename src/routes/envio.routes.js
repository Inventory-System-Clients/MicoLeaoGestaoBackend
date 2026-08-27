import express from "express";
import {
  criarEnvio,
  despacharEnvio,
  listarEnvios,
} from "../controllers/envioController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
);

router.get("/", listarEnvios);
router.post("/", registrarLog("CRIAR_ENVIO", "Envio"), criarEnvio);
router.patch(
  "/:id/despachar",
  registrarLog("DESPACHAR_ENVIO", "Envio"),
  despacharEnvio,
);

export default router;
