import express from "express";
import registroDinheiroController from "../controllers/registroDinheiroController.js";
import { autenticar } from "../middlewares/auth.js";
const router = express.Router();

router.use(autenticar);

// GET /registro-dinheiro/valor-esperado
router.get("/valor-esperado", registroDinheiroController.valorEsperado);

// POST /registro-dinheiro
router.post("/", registroDinheiroController.criar);

// GET /registro-dinheiro
router.get("/", registroDinheiroController.listar);

export default router;
