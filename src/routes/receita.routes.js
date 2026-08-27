import express from "express";
import {
  listarReceitas,
  salvarReceitaProduto,
} from "../controllers/receitaController.js";
import { autenticar, registrarLog, requireAdminCadastroOuEstoque } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarReceitas);
router.put(
  "/produto/:produtoId",
  requireAdminCadastroOuEstoque,
  registrarLog("SALVAR_RECEITA_PRODUTO", "ReceitaInsumo"),
  salvarReceitaProduto,
);

export default router;
