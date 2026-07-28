import express from "express";
import {
  atualizarStatusManutencao,
  criarManutencao,
  listarFuncionariosManutencao,
  listarManutencoes,
  obterHistoricoMaquina,
} from "../controllers/manutencaoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarManutencoes);
router.get(
  "/funcionarios",
  autorizarRole("ADMIN"),
  listarFuncionariosManutencao,
);
router.get("/maquina/:maquinaId", obterHistoricoMaquina);
router.post(
  "/",
  autorizarRole("ADMIN"),
  registrarLog("CRIAR_MANUTENCAO", "Manutencao"),
  criarManutencao,
);
router.patch(
  "/:id/status",
  registrarLog("ATUALIZAR_STATUS_MANUTENCAO", "Manutencao"),
  atualizarStatusManutencao,
);

export default router;
