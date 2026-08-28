import express from "express";
import {
  criarGastoVariavel,
  listarGastosVariaveis,
  atualizarGastoVariavel,
  excluirGastoVariavel,
} from "../controllers/gastoVariavelController.js";
import { autenticar, requireAdmin } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar, requireAdmin);

router.post("/", criarGastoVariavel);
router.get("/", listarGastosVariaveis);
router.put("/:id", atualizarGastoVariavel);
router.delete("/:id", excluirGastoVariavel);

export default router;
