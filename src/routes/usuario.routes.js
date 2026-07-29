import express from "express";
import {
  listarUsuarios,
  obterUsuario,
  criarUsuario,
  atualizarUsuario,
  deletarUsuario,
  reativarUsuario,
} from "../controllers/usuarioController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

// Listagem/leitura: ADMIN e Funcionário de Estoque (precisa escolher
// transportador ao montar um envio). Criar/editar/excluir/reativar
// continuam só ADMIN.
router.get("/", autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE"), listarUsuarios);
router.get(
  "/:id",
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE"),
  obterUsuario,
);
router.post(
  "/",
  autorizarRole("ADMIN"),
  registrarLog("CRIAR_USUARIO", "Usuario"),
  criarUsuario,
);
router.put(
  "/:id",
  autorizarRole("ADMIN"),
  registrarLog("EDITAR_USUARIO", "Usuario"),
  atualizarUsuario,
);
router.delete(
  "/:id",
  autorizarRole("ADMIN"),
  registrarLog("DELETAR_USUARIO", "Usuario"),
  deletarUsuario
);
router.patch(
  "/:id/reativar",
  autorizarRole("ADMIN"),
  registrarLog("REATIVAR_USUARIO", "Usuario"),
  reativarUsuario
);

export default router;
