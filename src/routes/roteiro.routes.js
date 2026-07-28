import express from "express";
import {
  atualizarItemRoteiro,
  atualizarRoteiro,
  concluirItemRoteiro,
  concluirMaquinaRoteiro,
  criarItemRoteiro,
  criarRoteiro,
  excluirItemRoteiro,
  excluirRoteiro,
  listarRoteiros,
} from "../controllers/roteiroController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarRoteiros);
router.post(
  "/",
  autenticar,
  requireAdmin,
  registrarLog("CRIAR_ROTEIRO", "Roteiro"),
  criarRoteiro,
);
router.put(
  "/:id",
  autenticar,
  requireAdmin,
  registrarLog("EDITAR_ROTEIRO", "Roteiro"),
  atualizarRoteiro,
);
router.delete(
  "/:id",
  autenticar,
  requireAdmin,
  registrarLog("EXCLUIR_ROTEIRO", "Roteiro"),
  excluirRoteiro,
);

router.post(
  "/:roteiroId/itens",
  autenticar,
  requireAdmin,
  registrarLog("CRIAR_ITEM_ROTEIRO", "RoteiroItem"),
  criarItemRoteiro,
);
router.put(
  "/itens/:id",
  autenticar,
  requireAdmin,
  registrarLog("EDITAR_ITEM_ROTEIRO", "RoteiroItem"),
  atualizarItemRoteiro,
);
router.patch(
  "/itens/:id/concluir",
  autenticar,
  registrarLog("CONCLUIR_ITEM_ROTEIRO", "RoteiroItem"),
  concluirItemRoteiro,
);
router.patch(
  "/itens/:id/maquinas/:maquinaId/concluir",
  autenticar,
  registrarLog("CONCLUIR_MAQUINA_ROTEIRO", "RoteiroItem"),
  concluirMaquinaRoteiro,
);
router.delete(
  "/itens/:id",
  autenticar,
  requireAdmin,
  registrarLog("EXCLUIR_ITEM_ROTEIRO", "RoteiroItem"),
  excluirItemRoteiro,
);

export default router;
