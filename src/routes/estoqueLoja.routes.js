import express from "express";
import {
  listarEstoqueLoja,
  atualizarEstoqueLoja,
  atualizarVariosEstoques,
  deletarEstoqueLoja,
  alertasEstoqueLoja,
  criarOuAtualizarProdutoEstoque,
  listarEstoqueMinhasLojas,
} from "../controllers/estoqueLojaController.js";
import { analisarEstoqueLoja } from "../controllers/estoqueAnaliseController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";
import { lojaDoEstoque } from "../utils/estoqueCompartilhado.js";

const router = express.Router();

// Debug middleware - registra todas as requisições para esta rota
router.use((req, res, next) => {
  console.log("🔍 [estoqueLoja.routes] Requisição recebida:", {
    method: req.method,
    url: req.url,
    params: req.params,
    body: req.body,
  });
  next();
});

// Estoque emprestado: loja (ou máquina avulsa) que usa o estoque de outra
// vê e mexe no estoque da loja dona (é o mesmo estoque). A análise resolve
// por conta própria (cruza as máquinas da própria loja com o estoque).
router.param("lojaId", async (req, res, next, lojaId) => {
  try {
    if (/\/analise\/?$/.test(req.path)) return next();
    req.params.lojaId = await lojaDoEstoque(lojaId);
    next();
  } catch (error) {
    next(error);
  }
});

// Alterar estoque: Admin, Chefe de Expedição e Cadastro (o Funcionário comum
// não usa em nenhuma tela; dá pra liberar por usuário em Acessos)
const podeAlterarEstoque = autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO");

// IMPORTANTE: Rotas específicas DEVEM vir ANTES de rotas com parâmetros dinâmicos
// Caso contrário, Express pode confundir 'alertas' ou 'varios' com um produtoId

// Rotas GET específicas primeiro
// Estoque das lojas do próprio usuário (só consulta)
router.get("/minhas", autenticar, listarEstoqueMinhasLojas);
router.get("/:lojaId/alertas", autenticar, alertasEstoqueLoja);
router.get("/:lojaId/analise", autenticar, analisarEstoqueLoja);
router.get("/:lojaId", autenticar, listarEstoqueLoja);

// Rotas POST específicas
router.post(
  "/:lojaId/varios",
  autenticar,
  podeAlterarEstoque,
  registrarLog("ATUALIZAR_VARIOS_ESTOQUES", "EstoqueLoja"),
  atualizarVariosEstoques
);

router.post(
  "/:lojaId",
  autenticar,
  podeAlterarEstoque,
  registrarLog("CRIAR_ATUALIZAR_ESTOQUE", "EstoqueLoja"),
  criarOuAtualizarProdutoEstoque
);

// Rotas PUT específicas
router.put(
  "/:lojaId/varios",
  autenticar,
  podeAlterarEstoque,
  registrarLog("ATUALIZAR_VARIOS_ESTOQUES", "EstoqueLoja"),
  atualizarVariosEstoques
);

router.put(
  "/:lojaId/:produtoId",
  autenticar,
  podeAlterarEstoque,
  registrarLog("ATUALIZAR_ESTOQUE_LOJA", "EstoqueLoja"),
  atualizarEstoqueLoja
);

// Rota DELETE por último
router.delete(
  "/:lojaId/:produtoId",
  autenticar,
  podeAlterarEstoque,
  registrarLog("DELETAR_ESTOQUE_LOJA", "EstoqueLoja"),
  deletarEstoqueLoja
);

export default router;
