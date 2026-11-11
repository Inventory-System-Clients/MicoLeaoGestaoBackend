import express from "express";
import {
  listarMovimentacoesEstoqueLoja,
  criarMovimentacaoEstoqueLoja,
  transferirDaGaragem,
  editarMovimentacaoEstoqueLoja,
  deletarMovimentacaoEstoqueLoja,
} from "../controllers/movimentacaoEstoqueLojaController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

// Movimentar estoque: Admin, Chefe de Expedição e Cadastro (o Funcionário
// comum não usa em nenhuma tela; dá pra liberar por usuário em Acessos)
const podeAlterarEstoque = autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO");

router.get("/", autenticar, listarMovimentacoesEstoqueLoja);
router.post("/transferir-do-deposito-principal", autenticar, podeAlterarEstoque, transferirDaGaragem);
router.post("/transferir-da-garagem", autenticar, podeAlterarEstoque, transferirDaGaragem);
router.post("/", autenticar, podeAlterarEstoque, criarMovimentacaoEstoqueLoja);
router.put("/:id", autenticar, podeAlterarEstoque, editarMovimentacaoEstoqueLoja);
router.delete("/:id", autenticar, podeAlterarEstoque, deletarMovimentacaoEstoqueLoja);

export default router;
