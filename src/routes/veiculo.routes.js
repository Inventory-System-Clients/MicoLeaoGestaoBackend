import express from "express";
import veiculoController from "../controllers/veiculoController.js";
import { autenticar } from "../middlewares/auth.js";
const router = express.Router();

router.get("/", autenticar, veiculoController.listar);
router.post("/", autenticar, veiculoController.criar);
router.put("/:id", autenticar, veiculoController.atualizar);
router.delete("/:id", autenticar, veiculoController.remover);

export default router;
