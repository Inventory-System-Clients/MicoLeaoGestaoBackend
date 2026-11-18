// Ações que uma tarefa agendada faz sozinha quando o responsável marca "Feito".
//
// Cada tipo:
//   nome         -> como aparece na tela
//   rota         -> a rota da API que faz a mesma coisa hoje. Quem cria a
//                   tarefa precisa ter acesso a ela (mesma regra de perfil e de
//                   Acessos), e a regra é conferida de novo no "Feito".
//   pedeNoFeito  -> informação que só se sabe na hora (ex.: nova validade)
//   preparar     -> confere os dados ao criar; devolve os dados limpos, a loja
//                   e um título sugerido. Lança erro com status 400/404.
//   executar     -> faz a ação; devolve o que foi feito (fica na tarefa)
import {
  Maquina,
  Loja,
  ContaPagar,
  ExtintorLoja,
} from "../models/index.js";
import { executarTransferenciaMaquina } from "../controllers/maquinaController.js";
import { decidirAcesso, ehPerfilAcessoTotal } from "../permissoes/acessos.js";
import { listarRotasDaApi } from "../permissoes/rotasDaApi.js";

export const erroTarefa = (status, mensagem) =>
  Object.assign(new Error(mensagem), { status });

export const hojeBrasilia = () =>
  new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (data) => (data ? String(data).slice(0, 10).split("-").reverse().join("/") : "");

// --- Permissão: o usuário consegue usar esta rota da API? ---
let rotasComPerfis = null;
const perfisDaRota = (metodo, caminho) => {
  // Lido do router na primeira vez (o router importa este arquivo)
  if (!rotasComPerfis) {
    rotasComPerfis = new Map(
      listarRotasDaApi().map((rota) => [`${rota.metodo} ${rota.caminho}`, rota.roles]),
    );
  }
  return rotasComPerfis.get(`${metodo} ${caminho}`);
};

export const podeUsarRota = (usuario, [metodo, caminho]) => {
  if (!usuario || usuario.ativo === false) return false;
  if (ehPerfilAcessoTotal(usuario.role)) return true;
  const exemplo = caminho.replace(/:[^/]+/g, "1");
  const decisao = decidirAcesso(usuario, metodo, exemplo);
  if (decisao === "NEGAR") return false;
  if (decisao === "LIBERAR") return true;
  const roles = perfisDaRota(metodo, caminho);
  return roles === null || (Array.isArray(roles) && roles.includes(usuario.role));
};

// --- Ajudantes ---
const buscarMaquina = async (maquinaId) => {
  const maquina = maquinaId
    ? await Maquina.findByPk(maquinaId, {
        include: [{ model: Loja, as: "loja", attributes: ["id", "nome"] }],
      })
    : null;
  if (!maquina || maquina.ativo === false) throw erroTarefa(400, "Escolha a máquina.");
  return maquina;
};
const nomeMaquina = (maquina) => `${maquina.codigo}${maquina.nome ? ` (${maquina.nome})` : ""}`;

const pedirNovaData = (corpo, rotulo) => {
  const novaData = String(corpo?.novaData || "");
  if (!DATA_VALIDA.test(novaData)) throw erroTarefa(400, `Informe a ${rotulo.toLowerCase()}.`);
  if (novaData <= hojeBrasilia()) throw erroTarefa(400, `A ${rotulo.toLowerCase()} tem que ser depois de hoje.`);
  return novaData;
};

export const ACOES_TAREFA = {
  LIVRE: {
    nome: "Tarefa livre",
    async preparar() {
      return { dados: {}, lojaId: null, titulo: null };
    },
    async executar() {
      return null;
    },
  },

  TRANSFERIR_MAQUINA: {
    nome: "Transferir máquina",
    rota: ["POST", "/api/maquinas/:id/transferir"],
    async preparar({ maquinaId, lojaDestinoId }) {
      const maquina = await buscarMaquina(maquinaId);
      const destino = lojaDestinoId ? await Loja.findByPk(lojaDestinoId) : null;
      if (lojaDestinoId && !destino) throw erroTarefa(400, "Loja de destino não encontrada.");
      if ((maquina.lojaId || null) === (destino?.id || null)) {
        throw erroTarefa(400, destino ? "A máquina já está nessa loja." : "A máquina já está no depósito.");
      }
      return {
        dados: { maquinaId: maquina.id, lojaDestinoId: destino?.id || null },
        lojaId: maquina.lojaId || destino?.id || null,
        titulo: `Transferir máquina ${nomeMaquina(maquina)} para ${destino ? destino.nome : "o depósito"}`,
      };
    },
    async executar(tarefa, { executor }) {
      const { maquina, transferencia } = await executarTransferenciaMaquina({
        maquinaId: tarefa.dados.maquinaId,
        lojaDestinoId: tarefa.dados.lojaDestinoId,
        dataTransferencia: hojeBrasilia(),
        observacao: `Tarefa ${tarefa.codigo}`,
        usuarioId: executor.id,
      });
      return {
        mensagem: `Máquina ${maquina.codigo} transferida para ${maquina.loja?.nome || "o depósito"}.`,
        transferenciaId: transferencia.id,
      };
    },
  },

  STATUS_MAQUINA: {
    nome: "Parar ou ligar máquina",
    rota: ["PUT", "/api/maquinas/:id"],
    async preparar({ maquinaId, statusOperacao, motivoParada }) {
      const maquina = await buscarMaquina(maquinaId);
      if (!["PARADA", "EM_OPERACAO"].includes(statusOperacao)) {
        throw erroTarefa(400, "Escolha se a máquina vai parar ou voltar a funcionar.");
      }
      const motivo = String(motivoParada || "").trim() || null;
      return {
        dados: { maquinaId: maquina.id, statusOperacao, motivoParada: statusOperacao === "PARADA" ? motivo : null },
        lojaId: maquina.lojaId || null,
        titulo:
          statusOperacao === "PARADA"
            ? `Parar máquina ${nomeMaquina(maquina)}${motivo ? ` (${motivo})` : ""}`
            : `Ligar máquina ${nomeMaquina(maquina)}`,
      };
    },
    async executar(tarefa) {
      const maquina = await buscarMaquina(tarefa.dados.maquinaId);
      const { statusOperacao } = tarefa.dados;
      if (statusOperacao === "EM_OPERACAO" && !maquina.lojaId) {
        throw erroTarefa(400, "A máquina está no depósito: transfira para uma loja antes de ligar.");
      }
      const anterior = maquina.statusOperacao;
      await maquina.update({
        statusOperacao,
        motivoParada:
          statusOperacao === "PARADA" ? tarefa.dados.motivoParada || `Parada pela tarefa ${tarefa.codigo}` : null,
      });
      return {
        mensagem: `Máquina ${maquina.codigo} ${statusOperacao === "PARADA" ? "parada" : "em operação"}.`,
        statusAnterior: anterior,
      };
    },
  },

  PRECO_MAQUINA: {
    nome: "Mudar preço da máquina",
    rota: ["PUT", "/api/maquinas/:id"],
    async preparar({ maquinaId, valor }) {
      const maquina = await buscarMaquina(maquinaId);
      const novo = Number(valor);
      if (!(novo > 0)) throw erroTarefa(400, "Informe o novo preço.");
      const rotulo = maquina.categoriaGeradora === "MAQUINA" ? "jogada" : "ficha";
      return {
        dados: { maquinaId: maquina.id, valor: Number(novo.toFixed(2)) },
        lojaId: maquina.lojaId || null,
        titulo: `Mudar o valor da ${rotulo} da máquina ${nomeMaquina(maquina)} para ${reais(novo)}`,
      };
    },
    async executar(tarefa) {
      const maquina = await buscarMaquina(tarefa.dados.maquinaId);
      // Mesma regra do cadastro: máquina (categoria MAQUINA) usa valor da
      // jogada; as outras, valor da ficha
      const campo = maquina.categoriaGeradora === "MAQUINA" ? "valorJogada" : "valorFicha";
      const anterior = Number(maquina[campo] || 0);
      await maquina.update({ [campo]: tarefa.dados.valor });
      return {
        mensagem: `Valor da ${campo === "valorJogada" ? "jogada" : "ficha"} da máquina ${maquina.codigo}: ${reais(anterior)} → ${reais(tarefa.dados.valor)}.`,
        campo,
        anterior,
        novo: tarefa.dados.valor,
      };
    },
  },

  PAGAR_CONTA: {
    nome: "Pagar conta",
    rota: ["PATCH", "/api/contas-pagar/:id/pagar"],
    async preparar({ contaPagarId }) {
      const conta = contaPagarId ? await ContaPagar.findByPk(contaPagarId) : null;
      if (!conta) throw erroTarefa(400, "Escolha a conta a pagar.");
      if (conta.status !== "PENDENTE") throw erroTarefa(400, "Essa conta já está paga.");
      const parcela = conta.totalParcelas > 1 ? ` (${conta.numeroParcela}/${conta.totalParcelas})` : "";
      return {
        dados: { contaPagarId: conta.id },
        lojaId: null,
        titulo: `Pagar ${conta.descricao}${parcela} · ${reais(conta.valorBrl ?? conta.valor)} · vence ${dataBr(conta.vencimento)}`,
      };
    },
    async executar(tarefa, { executor }) {
      const conta = await ContaPagar.findByPk(tarefa.dados.contaPagarId);
      if (!conta) throw erroTarefa(400, "A conta a pagar não existe mais.");
      if (conta.status !== "PENDENTE") throw erroTarefa(400, "Essa conta já está paga.");
      await conta.update({ status: "PAGA", pagoPorId: executor.id, pagoEm: new Date() });
      return { mensagem: `Conta "${conta.descricao}" marcada como paga.` };
    },
  },

  TROCAR_EXTINTOR: {
    nome: "Trocar extintor",
    rota: ["POST", "/api/extintores-loja/:lojaId"],
    pedeNoFeito: { campo: "novaData", rotulo: "Nova validade do extintor" },
    async preparar({ extintorId }) {
      const extintor = extintorId
        ? await ExtintorLoja.findByPk(extintorId, {
            include: [{ model: Loja, as: "loja", attributes: ["id", "nome"] }],
          })
        : null;
      if (!extintor) throw erroTarefa(400, "Escolha o extintor.");
      const nome = extintor.identificacao || extintor.numero;
      return {
        dados: { extintorId: extintor.id },
        lojaId: extintor.lojaId,
        titulo: `Trocar extintor${nome ? ` (${nome})` : ""} · ${extintor.loja?.nome || "loja"} · vence ${dataBr(extintor.dataVencimento)}`,
      };
    },
    async executar(tarefa, { corpo }) {
      const novaData = pedirNovaData(corpo, "Nova validade do extintor");
      const extintor = await ExtintorLoja.findByPk(tarefa.dados.extintorId);
      if (!extintor) throw erroTarefa(400, "O extintor não existe mais no cadastro da loja.");
      const anterior = extintor.dataVencimento;
      await extintor.update({ dataVencimento: novaData });
      return {
        mensagem: `Extintor trocado: validade ${dataBr(anterior)} → ${dataBr(novaData)}.`,
        anterior,
        novaData,
      };
    },
  },

  RENOVAR_CONTRATO: {
    nome: "Renovar contrato da loja",
    rota: ["PUT", "/api/lojas/:id"],
    pedeNoFeito: { campo: "novaData", rotulo: "Novo fim do contrato" },
    async preparar({ lojaId }) {
      const loja = lojaId ? await Loja.findByPk(lojaId) : null;
      if (!loja) throw erroTarefa(400, "Escolha a loja.");
      return {
        dados: { lojaId: loja.id },
        lojaId: loja.id,
        titulo: `Renovar contrato · ${loja.nome}${loja.dataFimContrato ? ` · vence ${dataBr(loja.dataFimContrato)}` : ""}`,
      };
    },
    async executar(tarefa, { corpo }) {
      const novaData = pedirNovaData(corpo, "Novo fim do contrato");
      const loja = await Loja.findByPk(tarefa.dados.lojaId);
      if (!loja) throw erroTarefa(400, "A loja não existe mais.");
      const anterior = loja.dataFimContrato;
      // Mesma regra da edição da loja: contrato novo zera o "adiar aviso"
      await loja.update({ dataFimContrato: novaData, contratoAvisoAdiadoDias: null });
      return {
        mensagem: `Contrato de ${loja.nome} renovado até ${dataBr(novaData)}.`,
        anterior,
        novaData,
      };
    },
  },
};

export const TIPOS_TAREFA = Object.keys(ACOES_TAREFA);

// Tipos que o usuário pode agendar (LIVRE: todos)
export const tiposPermitidos = (usuario) =>
  TIPOS_TAREFA.filter((tipo) => !ACOES_TAREFA[tipo].rota || podeUsarRota(usuario, ACOES_TAREFA[tipo].rota));
