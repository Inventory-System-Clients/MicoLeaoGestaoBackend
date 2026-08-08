import express from "express";
import {
  balançoSemanal,
  alertasEstoque,
  alertasMaquinaParada,
  alertasExtintor,
  alertasContrato,
  performanceMaquinas,
  relatorioImpressao,
  relatorioTodasLojas,
  buscarAlertasDeInconsistencia,
  ignorarAlertaMovimentacao,
  dashboardRelatorio,
  alertasMovimentacaoOut,
  alertasMovimentacaoIn,
  alertasBomDesempenho,
} from "../controllers/relatorioController.js";
import { alertasAbastecimentoIncompleto } from "../controllers/movimentacaoController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

// Novas rotas para alertas OUT e IN
// Alertas usados pela página/sino de Alertas — libera também o Funcionário
// de Cadastro (não é "ver relatório financeiro", é alerta operacional).
router.get(
  "/alertas-movimentacao-out",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasMovimentacaoOut,
);
router.get(
  "/alertas-movimentacao-in",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasMovimentacaoIn,
);
router.get(
  "/alertas-bom-desempenho",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasBomDesempenho,
);

// Relatórios/dashboards financeiros: restritos a ADMIN (Funcionário de
// Cadastro não tem acesso a financeiro/relatórios/gráficos).
router.get(
  "/balanco-semanal",
  autenticar,
  autorizarRole("ADMIN"),
  balançoSemanal,
);
router.get(
  "/alertas-movimentacao-inconsistente",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  buscarAlertasDeInconsistencia,
);
router.delete(
  "/alertas-movimentacao-inconsistente/:id",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  ignorarAlertaMovimentacao,
);
router.get(
  "/alertas-estoque",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasEstoque,
);
router.get(
  "/alertas-maquina-parada",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasMaquinaParada,
);
router.get(
  "/alertas-extintor",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasExtintor,
);
router.get(
  "/alertas-contrato",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasContrato,
);
router.get(
  "/performance-maquinas",
  autenticar,
  autorizarRole("ADMIN"),
  performanceMaquinas,
);
router.get(
  "/impressao",
  autenticar,
  autorizarRole("ADMIN"),
  relatorioImpressao,
);
router.get(
  "/todas-lojas",
  autenticar,
  autorizarRole("ADMIN"),
  relatorioTodasLojas,
);
router.get(
  "/dashboard",
  autenticar,
  autorizarRole("ADMIN"),
  dashboardRelatorio,
);
router.get(
  "/alertas-abastecimento-incompleto",
  autenticar,
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasAbastecimentoIncompleto,
);

export default router;
