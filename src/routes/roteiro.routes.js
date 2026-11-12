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
