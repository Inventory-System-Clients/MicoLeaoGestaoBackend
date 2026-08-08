import express from "express";
import controller from "../controllers/gastoFixoLojaController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"));

// Buscar gastos fixos de uma loja
router.get("/:lojaId", controller.getGastosFixos);

// Salvar (criar/atualizar) gastos fixos de uma loja
router.post("/:lojaId", controller.saveGastosFixos);

export default router;
