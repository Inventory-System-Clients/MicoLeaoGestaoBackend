import express from "express";
import visitaController from "../controllers/visitaController.js";
import { autenticar, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

// Movimentação em passos (Consultor de Vendas)
router.get("/lojas", autenticar, visitaController.lojas);
router.get("/maquinas/:id", autenticar, visitaController.maquina);
router.post("/analisar-foto", autenticar, visitaController.analisarFoto);
router.post(
  "/",
  autenticar,
  registrarLog("REGISTRAR_MOVIMENTACAO", "Movimentacao"),
  visitaController.registrar,
);

export default router;
