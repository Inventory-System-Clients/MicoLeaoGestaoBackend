import express from "express";
import {
  alertasManutencaoAtrasada,
  alertasManutencaoRecorrente,
  aceitarManutencao,
  aguardarManutencao,
  solicitarServicoManutencao,
  concluirManutencao,
  reenviarManutencao,
  finalizarManutencao,
  listarDestinosManutencao,
  autorizarManutencao,
  recusarManutencao,
  criarManutencao,
  listarFuncionariosManutencao,
  listarManutencoes,
  listarPecasQuebradasManutencao,
  listarPecasUsadasManutencao,
  obterHistoricoMaquina,
  registrarPecaQuebradaManutencao,
  registrarUsoPecaManutencao,
  editarManutencao,
  adicionarOcorrenciaManutencao,
  designarManutencao,
  listarPecasDisponiveisManutencao,
  adicionarPecaNecessariaManutencao,
  removerPecaNecessariaManutencao,
  pedirCompraPecaManutencao,
} from "../controllers/manutencaoController.js";
import {
  autenticar,
  autorizarRole,
  registrarLog,
} from "../middlewares/auth.js";

const router = express.Router();

router.use(autenticar);

router.get("/", listarManutencoes);
router.get(
  "/funcionarios",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  listarFuncionariosManutencao,
);
router.get("/maquina/:maquinaId", obterHistoricoMaquina);
router.get(
  "/alertas/atrasadas",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasManutencaoAtrasada,
);
router.get(
  "/alertas/recorrentes",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  alertasManutencaoRecorrente,
);
// Qualquer usuário abre manutenção, para um setor ou uma pessoa
router.get("/destinos", listarDestinosManutencao);
router.post("/", registrarLog("CRIAR_MANUTENCAO", "Manutencao"), criarManutencao);

// Quem recebeu: aceitar, não consigo (aguardando), serviço externo, concluir
router.post("/:id/aceitar", registrarLog("ACEITAR_MANUTENCAO", "Manutencao"), aceitarManutencao);
router.post("/:id/aguardar", registrarLog("AGUARDAR_MANUTENCAO", "Manutencao"), aguardarManutencao);
router.post("/:id/servico", registrarLog("SERVICO_MANUTENCAO", "Manutencao"), solicitarServicoManutencao);
router.post("/:id/concluir", registrarLog("CONCLUIR_MANUTENCAO", "Manutencao"), concluirManutencao);

// Admin e Funcionário de Cadastro: autorizar ou recusar solicitações
router.post(
  "/:id/autorizar",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("AUTORIZAR_MANUTENCAO", "Manutencao"),
  autorizarManutencao,
);
router.post(
  "/:id/recusar",
  autorizarRole("ADMIN", "FUNCIONARIO_CADASTRO"),
  registrarLog("RECUSAR_MANUTENCAO", "Manutencao"),
  recusarManutencao,
);

// Só o admin: reenviar e finalizar (com o gasto)
router.post(
  "/:id/reenviar",
  autorizarRole("ADMIN"),
  registrarLog("REENVIAR_MANUTENCAO", "Manutencao"),
  reenviarManutencao,
);
router.post(
  "/:id/finalizar",
  autorizarRole("ADMIN"),
  registrarLog("FINALIZAR_MANUTENCAO", "Manutencao"),
  finalizarManutencao,
);
// Editar (quem abriu, antes de aceitar; gestão) e juntar outra ocorrência
router.put("/:id", registrarLog("EDITAR_MANUTENCAO", "Manutencao"), editarManutencao);
router.post("/:id/ocorrencias", registrarLog("OCORRENCIA_MANUTENCAO", "Manutencao"), adicionarOcorrenciaManutencao);
// Chefe do setor escolhe quem faz
router.post("/:id/designar", registrarLog("DESIGNAR_MANUTENCAO", "Manutencao"), designarManutencao);
// Peças necessárias (checa estoque) e pedido de compra da que falta
router.get("/:id/pecas-disponiveis", listarPecasDisponiveisManutencao);
router.post("/:id/pecas-necessarias", registrarLog("PECA_NECESSARIA_MANUTENCAO", "Manutencao"), adicionarPecaNecessariaManutencao);
router.delete("/:id/pecas-necessarias/:itemId", registrarLog("REMOVER_PECA_NECESSARIA", "Manutencao"), removerPecaNecessariaManutencao);
router.post("/:id/pedir-compra", registrarLog("PEDIR_COMPRA_PECA_MANUTENCAO", "Manutencao"), pedirCompraPecaManutencao);

router.get("/:id/pecas", listarPecasUsadasManutencao);
router.post(
  "/:id/pecas",
  registrarLog("REGISTRAR_USO_PECA", "ManutencaoPeca"),
  registrarUsoPecaManutencao,
);
router.get("/:id/pecas-quebradas", listarPecasQuebradasManutencao);
router.post(
  "/:id/pecas-quebradas",
  registrarLog("REGISTRAR_PECA_QUEBRADA", "ManutencaoPecaQuebrada"),
  registrarPecaQuebradaManutencao,
);

export default router;
