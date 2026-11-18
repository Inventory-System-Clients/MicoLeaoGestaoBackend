import express from "express";
import calendarioController from "../controllers/calendarioController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

// Calendário: admin (dá para liberar para outros em Acessos)
router.use(autenticar, autorizarRole("ADMIN"));

router.get("/", calendarioController.listar);
router.post("/periodos", calendarioController.salvarPeriodo);
router.put("/periodos/:id", calendarioController.salvarPeriodo);
router.delete("/periodos/:id", calendarioController.excluirPeriodo);

export default router;
