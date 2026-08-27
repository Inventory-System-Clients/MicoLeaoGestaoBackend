import express from "express";
import {
  atualizarTipoMaquina,
  criarTipoMaquina,
  deletarTipoMaquina,
  listarTiposMaquina,
} from "../controllers/tipoMaquinaController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarTiposMaquina);
router.post(
  "/",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("CRIAR_TIPO_MAQUINA", "TipoMaquina"),
  criarTipoMaquina,
);
router.put(
  "/:id",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("EDITAR_TIPO_MAQUINA", "TipoMaquina"),
  atualizarTipoMaquina,
);
router.delete(
  "/:id",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("EXCLUIR_TIPO_MAQUINA", "TipoMaquina"),
  deletarTipoMaquina,
);

export default router;
