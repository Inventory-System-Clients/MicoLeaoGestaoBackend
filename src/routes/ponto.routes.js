import express from "express";
import pontoController from "../controllers/pontoController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

// Funcionário
router.get("/meu", autenticar, pontoController.meuPonto);
router.post("/batidas", autenticar, pontoController.bater);

// Administrador
const admin = [autenticar, autorizarRole("ADMIN")];
router.get("/admin/painel", ...admin, pontoController.painel);
router.get("/admin/batidas", ...admin, pontoController.listarBatidas);
router.get("/admin/espelho", ...admin, pontoController.espelho);
router.get("/admin/resumo", ...admin, pontoController.resumo);
router.post("/admin/ajustes", ...admin, pontoController.ajustar);
router.patch("/admin/batidas/:id/desconsiderar", ...admin, pontoController.desconsiderar);
router.get("/admin/locais", ...admin, pontoController.listarLocais);
router.post("/admin/locais", ...admin, pontoController.salvarLocal);
router.put("/admin/locais/:id", ...admin, pontoController.salvarLocal);
router.delete("/admin/locais/:id", ...admin, pontoController.desativarLocal);
router.put("/admin/jornadas/:usuarioId", ...admin, pontoController.salvarJornada);

export default router;
