import express from "express";
import {
  listarCotacoes,
  registrarCotacao,
} from "../controllers/cotacaoMoedaController.js";
import { autenticar, requireAdmin, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, requireAdmin, listarCotacoes);
router.post(
  "/",
  autenticar,
  requireAdmin,
  registrarLog("REGISTRAR_COTACAO_MOEDA", "CotacaoMoeda"),
  registrarCotacao,
);

export default router;
