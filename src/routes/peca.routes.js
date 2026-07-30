import express from "express";
import {
  atualizarPeca,
  criarPeca,
  deletarPeca,
  devolverPecaFuncionario,
  enviarPecaFuncionario,
  lancarQuantidadePeca,
  listarEnviosPeca,
  listarEstoquePecasFuncionario,
  listarPecas,
} from "../controllers/pecaController.js";
import { autenticar, registrarLog, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarPecas);
router.get("/envios", requireAdmin, listarEnviosPeca);
router.get("/estoque-funcionario", listarEstoquePecasFuncionario);
router.post(
  "/",
  requireAdmin,
  registrarLog("CRIAR_PECA", "Peca"),
  criarPeca,
);
router.put(
  "/:id",
  requireAdmin,
  registrarLog("EDITAR_PECA", "Peca"),
  atualizarPeca,
);
router.delete(
  "/:id",
  requireAdmin,
  registrarLog("EXCLUIR_PECA", "Peca"),
  deletarPeca,
);
router.post(
  "/:id/lancar-quantidade",
  requireAdmin,
  registrarLog("LANCAR_QUANTIDADE_PECA", "Peca"),
  lancarQuantidadePeca,
);
router.post(
  "/:id/enviar",
  requireAdmin,
  registrarLog("ENVIAR_PECA_FUNCIONARIO", "MovimentacaoPeca"),
  enviarPecaFuncionario,
);
router.post(
  "/:id/devolver",
  registrarLog("DEVOLVER_PECA_FUNCIONARIO", "MovimentacaoPeca"),
  devolverPecaFuncionario,
);

export default router;
