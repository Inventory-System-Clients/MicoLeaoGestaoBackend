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
  requireAdminOuCadastro,
} from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/pendentes", listarLacresPendentes);
router.get(
  "/divergentes",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
  listarLacresDivergentes,
);
router.get(
  "/alertas/em-transito",
  requireAdminOuCadastro,
  alertasLacresEmTransito,
);
router.patch(
  "/:id/conferir",
  registrarLog("CONFERIR_LACRE", "Lacre"),
  conferirLacre,
);
router.patch(
  "/:id/resolver",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
  registrarLog("RESOLVER_LACRE_DIVERGENTE", "Lacre"),
  resolverLacreDivergente,
);

router.patch(
  "/:id/reabrir",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
  registrarLog("REABRIR_LACRE", "Lacre"),
  reabrirLacre,
);

export default router;
