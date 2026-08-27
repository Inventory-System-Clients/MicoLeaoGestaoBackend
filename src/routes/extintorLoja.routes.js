import express from "express";
import controller from "../controllers/extintorLojaController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"));

// Buscar extintores de uma loja
router.get("/:lojaId", controller.getExtintores);

// Salvar (criar/atualizar/remover) extintores de uma loja
router.post("/:lojaId", controller.saveExtintores);

export default router;
