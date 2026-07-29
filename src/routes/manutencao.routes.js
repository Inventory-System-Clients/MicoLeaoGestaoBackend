import express from "express";
import {
  alertasManutencaoAtrasada,
  alertasManutencaoRecorrente,
  atualizarStatusManutencao,
  criarManutencao,
  listarFuncionariosManutencao,
  listarManutencoes,
  listarPecasUsadasManutencao,
  obterHistoricoMaquina,
  registrarUsoPecaManutencao,
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
router.get(
  "/alertas/atrasadas",
  autorizarRole("ADMIN"),
  alertasManutencaoAtrasada,
);
router.get(
  "/alertas/recorrentes",
  autorizarRole("ADMIN"),
  alertasManutencaoRecorrente,
);
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
router.get("/:id/pecas", listarPecasUsadasManutencao);
router.post(
  "/:id/pecas",
  registrarLog("REGISTRAR_USO_PECA", "ManutencaoPeca"),
  registrarUsoPecaManutencao,
);

export default router;
