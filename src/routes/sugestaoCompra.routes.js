import express from "express";
import {
  listarSugestoesCompra,
  criarSugestaoCompra,
  recusarSugestaoCompra,
} from "../controllers/sugestaoCompraController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(
  autenticar,
  autorizarRole("ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
);

router.get("/", listarSugestoesCompra);
router.post(
  "/",
  registrarLog("CRIAR_SUGESTAO_COMPRA", "SugestaoCompra"),
  criarSugestaoCompra,
);
router.patch(
  "/:id/recusar",
  autorizarRole("ADMIN", "DESENVOLVEDOR"),
  registrarLog("RECUSAR_SUGESTAO_COMPRA", "SugestaoCompra"),
  recusarSugestaoCompra,
);

export default router;
