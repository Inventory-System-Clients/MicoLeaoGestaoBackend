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
import { autenticar, registrarLog, requireAdminOuCadastro } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarPecas);
router.get("/envios", requireAdminOuCadastro, listarEnviosPeca);
router.get("/estoque-funcionario", listarEstoquePecasFuncionario);
router.post(
  "/",
  requireAdminOuCadastro,
  registrarLog("CRIAR_PECA", "Peca"),
  criarPeca,
);
router.put(
  "/:id",
  requireAdminOuCadastro,
  registrarLog("EDITAR_PECA", "Peca"),
  atualizarPeca,
);
router.delete(
  "/:id",
  requireAdminOuCadastro,
  registrarLog("EXCLUIR_PECA", "Peca"),
  deletarPeca,
);
router.post(
  "/:id/lancar-quantidade",
  requireAdminOuCadastro,
  registrarLog("LANCAR_QUANTIDADE_PECA", "Peca"),
  lancarQuantidadePeca,
);
router.post(
  "/:id/enviar",
  requireAdminOuCadastro,
  registrarLog("ENVIAR_PECA_FUNCIONARIO", "MovimentacaoPeca"),
  enviarPecaFuncionario,
);
router.post(
  "/:id/devolver",
  registrarLog("DEVOLVER_PECA_FUNCIONARIO", "MovimentacaoPeca"),
  devolverPecaFuncionario,
);

export default router;
