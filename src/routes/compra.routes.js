import express from "express";
import {
  atualizarCompra,
  atualizarStatusCompra,
  conferirRecebimentoCompra,
  criarCompra,
  deletarCompra,
  historicoPrecos,
  listarCompras,
} from "../controllers/compraController.js";
import { gerarParcelasDeCompra } from "../controllers/contaPagarController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

const router = express.Router();

router.use(
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"),
);

router.get("/", listarCompras);
router.get("/historico-precos", historicoPrecos);
router.post("/", registrarLog("CRIAR_COMPRA", "Compra"), criarCompra);
router.put("/:id", registrarLog("EDITAR_COMPRA", "Compra"), atualizarCompra);
router.patch(
  "/:id/status",
  registrarLog("ATUALIZAR_STATUS_COMPRA", "Compra"),
  atualizarStatusCompra,
);
router.patch(
  "/:id/conferencia",
  registrarLog("CONFERIR_RECEBIMENTO_COMPRA", "Compra"),
  conferirRecebimentoCompra,
);
router.delete(
  "/:id",
  registrarLog("EXCLUIR_COMPRA", "Compra"),
  deletarCompra,
);
router.post(
  "/:id/contas-pagar",
  registrarLog("GERAR_CONTAS_PAGAR", "ContaPagar"),
  gerarParcelasDeCompra,
);

export default router;
