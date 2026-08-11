import express from "express";
import {
  listarMaquinas,
  obterMaquina,
  criarMaquina,
  atualizarMaquina,
  deletarMaquina,
  obterEstoqueAtual,
  transferirMaquina,
  listarTransferenciasMaquina,
} from "../controllers/maquinaController.js";
import { produtoSugeridoPorMaquina } from "../controllers/produtoSugeridoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";
import { problemaMaquina } from "../controllers/movimentacaoController.js";

const router = express.Router();

router.get("/", autenticar, listarMaquinas);
router.get("/:id", autenticar, obterMaquina);
router.get("/:id/estoque", autenticar, obterEstoqueAtual);
router.get("/:id/produto-sugerido", autenticar, produtoSugeridoPorMaquina);
router.get("/:id/problema", autenticar, problemaMaquina);
router.get("/:id/transferencias", autenticar, listarTransferenciasMaquina);
router.post(
  "/:id/transferir",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("TRANSFERIR_MAQUINA", "Maquina"),
  transferirMaquina,
);
router.post(
  "/",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("CRIAR_MAQUINA", "Maquina"),
  criarMaquina,
);
router.put(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("EDITAR_MAQUINA", "Maquina"),
  atualizarMaquina,
);
router.delete(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("DELETAR_MAQUINA", "Maquina"),
  deletarMaquina,
);

export default router;
