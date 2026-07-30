import express from "express";
import {
  alertasLacresEmTransito,
  conferirLacre,
  listarLacresDivergentes,
  listarLacresPendentes,
  reabrirLacre,
  resolverLacreDivergente,
} from "../controllers/lacreController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
  requireAdmin,
} from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/pendentes", listarLacresPendentes);
router.get(
  "/divergentes",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE"),
  listarLacresDivergentes,
);
router.get("/alertas/em-transito", requireAdmin, alertasLacresEmTransito);
router.patch(
  "/:id/conferir",
  registrarLog("CONFERIR_LACRE", "Lacre"),
  conferirLacre,
);
router.patch(
  "/:id/resolver",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE"),
  registrarLog("RESOLVER_LACRE_DIVERGENTE", "Lacre"),
  resolverLacreDivergente,
);

router.patch(
  "/:id/reabrir",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE"),
  registrarLog("REABRIR_LACRE", "Lacre"),
  reabrirLacre,
);

export default router;
