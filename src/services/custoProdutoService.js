import { Op } from "sequelize";
import {
  CompraItem,
  Compra,
  Produto,
  ProdutoCustoHistorico,
} from "../models/index.js";
import { buscarHistoricoCotacao, converterParaReal } from "./cotacaoService.js";

// Janela usada pra calcular o custo médio ponderado de compra de um produto:
// só compras recebidas nos últimos N dias antes da data de referência (fim
// do período do relatório) entram na conta.
const JANELA_DIAS = 90;

// Valores de compra em dólar são convertidos pra real na cotação que valia
// no recebimento (Financeiro > Configuração de moeda).
const somarPorProduto = (itens, historicoCotacao) => {
  const mapa = new Map();

  for (const item of itens) {
    const produtoId = item.produtoId;
    const quantidade = Number(
      item.quantidadeRecebida ?? item.quantidade ?? 0,
    );
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue;

    const valorTotalItemNaMoeda =
      item.valorTotal !== null && item.valorTotal !== undefined
        ? Number(item.valorTotal)
        : quantidade * Number(item.valorUnitario || 0);
    const valorTotalItem = converterParaReal(
      valorTotalItemNaMoeda,
      item["compra.moeda"],
      historicoCotacao,
      item["compra.recebidoEm"],
    );

    const atual = mapa.get(produtoId) || { quantidade: 0, valorTotal: 0 };
    atual.quantidade += quantidade;
    atual.valorTotal += valorTotalItem;
    mapa.set(produtoId, atual);
  }

  return mapa;
};

const buscarItensCompraRecebidos = async (produtoIds, { inicio, fim } = {}) => {
  const whereCompra = { status: "RECEBIDO" };
  if (inicio || fim) {
    whereCompra.recebidoEm = {};
    if (inicio) whereCompra.recebidoEm[Op.gte] = inicio;
    if (fim) whereCompra.recebidoEm[Op.lte] = fim;
  }

  return CompraItem.findAll({
    where: { produtoId: { [Op.in]: produtoIds } },
    attributes: [
      "produtoId",
      "quantidade",
      "quantidadeRecebida",
      "valorUnitario",
      "valorTotal",
    ],
    include: [
      {
        model: Compra,
        as: "compra",
        attributes: ["moeda", "recebidoEm"],
        required: true,
        where: whereCompra,
      },
    ],
    raw: true,
  });
};

// Custo médio ponderado por unidade de cada produto, na data de referência
// (normalmente o fim do período do relatório). Não usa mais o custoUnitario
// cadastrado no produto como fonte principal — só como último recurso.
//
// Ordem de prioridade:
// 1. Média ponderada das compras RECEBIDAS nos últimos 90 dias antes da
//    referência (quantidade recebida x valor unitário de cada compra).
// 2. Se não houve compra nesse período, média ponderada de TODAS as compras
//    já recebidas do produto (histórico completo).
// 3. Se o produto nunca teve nenhuma compra recebida, cai pro
//    custoUnitario/preco cadastrado no cadastro do produto.
export const calcularCustoMedioProdutos = async (
  produtoIds,
  dataReferencia = new Date(),
) => {
  const idsUnicos = [...new Set((produtoIds || []).filter(Boolean))];
  const resultado = new Map();
  if (idsUnicos.length === 0) return resultado;

  const janelaInicio = new Date(dataReferencia);
  janelaInicio.setDate(janelaInicio.getDate() - JANELA_DIAS);

  const [itensJanela, itensTodos, produtos, historicoCotacao] = await Promise.all([
    buscarItensCompraRecebidos(idsUnicos, {
      inicio: janelaInicio,
      fim: dataReferencia,
    }),
    buscarItensCompraRecebidos(idsUnicos, { fim: dataReferencia }),
    Produto.findAll({
      where: { id: { [Op.in]: idsUnicos } },
      attributes: ["id", "custoUnitario", "preco"],
      raw: true,
    }),
    buscarHistoricoCotacao("USD"),
  ]);

  const mapaJanela = somarPorProduto(itensJanela, historicoCotacao);
  const mapaTodos = somarPorProduto(itensTodos, historicoCotacao);
  const mapaProdutos = new Map(produtos.map((produto) => [produto.id, produto]));

  for (const produtoId of idsUnicos) {
    const agregJanela = mapaJanela.get(produtoId);
    const agregTodos = mapaTodos.get(produtoId);

    let custoMedio = 0;
    if (agregJanela && agregJanela.quantidade > 0) {
      custoMedio = agregJanela.valorTotal / agregJanela.quantidade;
    } else if (agregTodos && agregTodos.quantidade > 0) {
      custoMedio = agregTodos.valorTotal / agregTodos.quantidade;
    } else {
      const produto = mapaProdutos.get(produtoId);
      const custoUnitarioCadastrado = Number(produto?.custoUnitario || 0);
      const precoCadastrado = Number(produto?.preco || 0);
      custoMedio =
        custoUnitarioCadastrado > 0 ? custoUnitarioCadastrado : precoCadastrado;
    }

    resultado.set(produtoId, Number(custoMedio.toFixed(2)));
  }

  return resultado;
};

// Histórico do custoUnitario de cada produto (na tela: "Custo pelúcia"), em
// ordem crescente de vigência. Usado junto com custoHistoricoNaData pra achar o
// custo que valia no dia de cada saída — trocar o custo hoje não muda o custo
// de saídas que já aconteceram.
export const buscarHistoricoCustoProduto = async (produtoIds) => {
  const idsUnicos = [...new Set((produtoIds || []).filter(Boolean))];
  const resultado = new Map();
  if (idsUnicos.length === 0) return resultado;

  const linhas = await ProdutoCustoHistorico.findAll({
    where: { produtoId: { [Op.in]: idsUnicos } },
    attributes: ["produtoId", "custo", "vigenteDesde"],
    order: [["vigenteDesde", "ASC"]],
    raw: true,
  });

  for (const linha of linhas) {
    const lista = resultado.get(linha.produtoId) || [];
    lista.push({
      custo: Number(linha.custo),
      vigenteDesde: new Date(linha.vigenteDesde),
    });
    resultado.set(linha.produtoId, lista);
  }

  return resultado;
};

// custoUnitario que valia pro produto na data informada, ou null se nessa
// data ainda não tinha nenhuma troca de custo registrada no histórico (aí quem chama cai no
// custo médio de compra, como era antes).
export const custoHistoricoNaData = (historicoPorProduto, produtoId, data) => {
  const lista = historicoPorProduto?.get(produtoId);
  if (!lista || lista.length === 0 || !data) return null;

  const momento = new Date(data).getTime();
  let custo = null;
  for (const item of lista) {
    if (item.vigenteDesde.getTime() > momento) break;
    custo = item.custo;
  }
  return custo;
};

// Atalho pros cálculos de gasto de produtos: custoUnitario vigente na data da
// saída, se houver; senão o custo médio de compra do produto.
export const custoUnitarioNaData = (
  historicoPorProduto,
  custoMedioPorProduto,
  produtoId,
  data,
) => {
  const custoHistorico = custoHistoricoNaData(historicoPorProduto, produtoId, data);
  if (custoHistorico !== null) return custoHistorico;
  return Number(custoMedioPorProduto?.get(produtoId) || 0);
};

// Grava no histórico uma troca do custoUnitario do produto,
// valendo a partir de agora. Só grava se o valor mudou de fato; as linhas
// antigas nunca são alteradas, então saídas passadas mantêm o custo da época.
// Chamado pelo cadastro do produto e pelo recebimento de compra (compraId
// liga a linha à compra, pra poder apagar se o recebimento for desfeito).
export const registrarTrocaCustoProduto = async ({
  produtoId,
  custoAnterior,
  custoNovo,
  usuarioId,
  compraId,
  transaction,
}) => {
  if (custoNovo === null || custoNovo === undefined || custoNovo === "") return;
  const novo = Number(Number(custoNovo).toFixed(2));
  const anterior = Number(Number(custoAnterior || 0).toFixed(2));
  if (!Number.isFinite(novo) || novo < 0 || novo === anterior) return;

  await ProdutoCustoHistorico.create(
    {
      produtoId,
      custo: novo,
      vigenteDesde: new Date(),
      usuarioId: usuarioId || null,
      compraId: compraId || null,
    },
    { transaction },
  );
};

// Desfaz as trocas de custo que o recebimento de uma compra gravou: apaga as
// linhas dela do histórico e volta o custoUnitario de cada produto para o
// último custo que sobrou no histórico. Chamar quando um recebimento for
// desfeito (hoje o sistema não tem esse fluxo — compra recebida não volta).
export const removerCustosDaCompra = async (compraId, transaction) => {
  if (!compraId) return;

  const linhas = await ProdutoCustoHistorico.findAll({
    where: { compraId },
    attributes: ["id", "produtoId"],
    raw: true,
    transaction,
  });
  if (linhas.length === 0) return;

  await ProdutoCustoHistorico.destroy({ where: { compraId }, transaction });

  const produtoIds = [...new Set(linhas.map((linha) => linha.produtoId))];
  for (const produtoId of produtoIds) {
    const ultimoRestante = await ProdutoCustoHistorico.findOne({
      where: { produtoId },
      order: [["vigenteDesde", "DESC"]],
      transaction,
    });
    if (ultimoRestante) {
      await Produto.update(
        { custoUnitario: ultimoRestante.custo },
        { where: { id: produtoId }, transaction },
      );
    }
  }
};
