import express from "express";
import {
  criarEnvio,
  despacharEnvio,
  listarEnvios,
} from "../controllers/envioController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "ENTREGADOR"));

router.get("/", listarEnvios);
router.post(
  "/",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE"),
  registrarLog("CRIAR_ENVIO", "Envio"),
  criarEnvio,
);
router.patch(
  "/:id/despachar",
  registrarLog("DESPACHAR_ENVIO", "Envio"),
  despacharEnvio,
);

export default router;
