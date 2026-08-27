import express from "express";
import controller from "../controllers/transportadorController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

router.use(
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
);

router.get("/", controller.listarTransportadores);
router.post("/", controller.criarTransportador);
router.put("/:id", controller.atualizarTransportador);

export default router;
