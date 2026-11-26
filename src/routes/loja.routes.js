import express from "express";
import {
  listarLojas,
  obterLoja,
  criarLoja,
  atualizarLoja,
  deletarLoja,
} from "../controllers/lojaController.js";
import { documentosDe } from "../controllers/documentoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.get("/", autenticar, listarLojas);

// Documentos em PDF da loja (contratos): quem cadastra/edita loja
const documentosLoja = documentosDe("LOJA");
const podeDocumentosLoja = autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO");
router.get("/:id/documentos", autenticar, podeDocumentosLoja, documentosLoja.listar);
router.post(
  "/:id/documentos",
  autenticar,
  podeDocumentosLoja,
  registrarLog("ENVIAR_DOCUMENTO_LOJA", "Documento"),
  documentosLoja.criar
);
router.delete(
  "/:id/documentos/:documentoId",
  autenticar,
  podeDocumentosLoja,
  registrarLog("REMOVER_DOCUMENTO_LOJA", "Documento"),
  documentosLoja.excluir
);
router.get("/:id", autenticar, obterLoja);
router.post(
  "/",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("CRIAR_LOJA", "Loja"),
  criarLoja
);
router.put(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("EDITAR_LOJA", "Loja"),
  atualizarLoja
);
router.delete(
  "/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("DELETAR_LOJA", "Loja"),
  deletarLoja
);

export default router;
