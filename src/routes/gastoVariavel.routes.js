import express from "express";
import {
  criarGastoVariavel,
  listarGastosVariaveis,
  atualizarGastoVariavel,
  excluirGastoVariavel,
} from "../controllers/gastoVariavelController.js";
import { autenticar } from "../middlewares/auth.js";

const router = express.Router();

router.post("/", autenticar, criarGastoVariavel);
router.get("/", autenticar, listarGastosVariaveis);
router.put("/:id", autenticar, atualizarGastoVariavel);
router.delete("/:id", autenticar, excluirGastoVariavel);

export default router;
