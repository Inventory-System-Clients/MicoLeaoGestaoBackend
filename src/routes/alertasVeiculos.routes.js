import express from "express";
import alertasVeiculosController from "../controllers/alertasVeiculosController.js";
import { autenticar } from "../middlewares/auth.js";
const router = express.Router();

router.get("/", autenticar, alertasVeiculosController.listarAlertas);

export default router;
