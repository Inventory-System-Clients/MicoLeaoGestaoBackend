import express from "express";
import {
  conferirLacre,
  listarLacresDivergentes,
  listarLacresPendentes,
  reabrirLacre,
} from "../controllers/lacreController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/pendentes", listarLacresPendentes);
router.get("/divergentes", requireAdmin, listarLacresDivergentes);
router.patch(
  "/:id/conferir",
  registrarLog("CONFERIR_LACRE", "Lacre"),
  conferirLacre,
);
router.patch(
  "/:id/reabrir",
  requireAdmin,
  registrarLog("REABRIR_LACRE", "Lacre"),
  reabrirLacre,
);

export default router;
