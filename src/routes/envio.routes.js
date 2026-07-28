import express from "express";
import {
  criarEnvio,
  despacharEnvio,
  listarEnvios,
} from "../controllers/envioController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, requireAdmin);

router.get("/", listarEnvios);
router.post("/", registrarLog("CRIAR_ENVIO", "Envio"), criarEnvio);
router.patch(
  "/:id/despachar",
  registrarLog("DESPACHAR_ENVIO", "Envio"),
  despacharEnvio,
);

export default router;
