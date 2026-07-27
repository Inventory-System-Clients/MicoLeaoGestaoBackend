import express from "express";
import {
  criarItem,
  desativarItem,
  editarItem,
  listarDevolucoesPendentes,
  listarItens,
  listarMovimentacoes,
  registrarMovimentacao,
} from "../controllers/suporteTecnicoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/itens", listarItens);
router.post(
  "/itens",
  autorizarRole("ADMIN"),
  registrarLog("CRIAR_ITEM_SUPORTE", "SuporteItem"),
  criarItem,
);
router.put(
  "/itens/:id",
  autorizarRole("ADMIN"),
  registrarLog("EDITAR_ITEM_SUPORTE", "SuporteItem"),
  editarItem,
);
router.delete(
  "/itens/:id",
  autorizarRole("ADMIN"),
  registrarLog("DESATIVAR_ITEM_SUPORTE", "SuporteItem"),
  desativarItem,
);

router.get("/movimentacoes", autorizarRole("ADMIN"), listarMovimentacoes);
router.post(
  "/movimentacoes",
  registrarLog("MOVIMENTAR_ITEM_SUPORTE", "SuporteMovimentacao"),
  registrarMovimentacao,
);

router.get("/devolucoes-pendentes", listarDevolucoesPendentes);

export default router;
