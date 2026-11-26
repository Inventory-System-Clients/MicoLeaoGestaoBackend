import express from "express";
import {
  atualizarItemRoteiro,
  atualizarRoteiro,
  concluirItemRoteiro,
  concluirMaquinaRoteiro,
  criarItemRoteiro,
  criarRoteiro,
  excluirItemRoteiro,
  excluirRoteiro,
  listarRoteiros,
  opcoesRota,
  iniciarRotaManual,
  finalizarRota,
  devolverVeiculoRota,
  marcarChegadaParada,
  marcarSaidaParada,
  adicionarPeriodoRota,
  removerPeriodoRota,
} from "../controllers/roteiroController.js";
import { autenticar, autorizarRole, registrarLog } from "../middlewares/auth.js";

// Rotas do motorista: criam/editam Admin e Chefe de Expedição (e o Gerente
// de Vendas, pelo padrão do perfil). O motorista inicia, entrega e finaliza.
const gestaoRotas = autorizarRole("ADMIN", "FUNCIONARIO_ESTOQUE");

const router = express.Router();

router.get("/", autenticar, listarRoteiros);
router.get("/opcoes", autenticar, gestaoRotas, opcoesRota);
router.post("/:id/iniciar", autenticar, registrarLog("INICIAR_ROTA", "Roteiro"), iniciarRotaManual);
router.post("/:id/finalizar", autenticar, registrarLog("FINALIZAR_ROTA", "Roteiro"), finalizarRota);
// Devolver o carro antes de finalizar (a rota continua em andamento)
router.post("/:id/devolver-veiculo", autenticar, registrarLog("DEVOLVER_VEICULO_ROTA", "Roteiro"), devolverVeiculoRota);
// Períodos que as pessoas da rota vão fazer (vão para o calendário)
router.post("/:id/periodos", autenticar, registrarLog("PERIODO_ROTA", "Roteiro"), adicionarPeriodoRota);
router.delete("/:id/periodos/:periodoId", autenticar, registrarLog("REMOVER_PERIODO_ROTA", "Roteiro"), removerPeriodoRota);
// Cheguei / saí da loja (parada)
router.patch("/itens/:id/chegada", autenticar, registrarLog("CHEGADA_PARADA_ROTA", "RoteiroItem"), marcarChegadaParada);
router.patch("/itens/:id/saida", autenticar, registrarLog("SAIDA_PARADA_ROTA", "RoteiroItem"), marcarSaidaParada);
router.post(
  "/",
  autenticar,
  gestaoRotas,
  registrarLog("CRIAR_ROTEIRO", "Roteiro"),
  criarRoteiro,
);
router.put(
  "/:id",
  autenticar,
  gestaoRotas,
  registrarLog("EDITAR_ROTEIRO", "Roteiro"),
  atualizarRoteiro,
);
router.delete(
  "/:id",
  autenticar,
  gestaoRotas,
  registrarLog("EXCLUIR_ROTEIRO", "Roteiro"),
  excluirRoteiro,
);

router.post(
  "/:roteiroId/itens",
  autenticar,
  gestaoRotas,
  registrarLog("CRIAR_ITEM_ROTEIRO", "RoteiroItem"),
  criarItemRoteiro,
);
router.put(
  "/itens/:id",
  autenticar,
  gestaoRotas,
  registrarLog("EDITAR_ITEM_ROTEIRO", "RoteiroItem"),
  atualizarItemRoteiro,
);
router.patch(
  "/itens/:id/concluir",
  autenticar,
  registrarLog("CONCLUIR_ITEM_ROTEIRO", "RoteiroItem"),
  concluirItemRoteiro,
);
router.patch(
  "/itens/:id/maquinas/:maquinaId/concluir",
  autenticar,
  registrarLog("CONCLUIR_MAQUINA_ROTEIRO", "RoteiroItem"),
  concluirMaquinaRoteiro,
);
router.delete(
  "/itens/:id",
  autenticar,
  gestaoRotas,
  registrarLog("EXCLUIR_ITEM_ROTEIRO", "RoteiroItem"),
  excluirItemRoteiro,
);

export default router;
