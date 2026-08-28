import { Op } from "sequelize";
import { CompraItem, Compra, Produto } from "../models/index.js";

// Janela usada pra calcular o custo médio ponderado de compra de um produto:
// só compras recebidas nos últimos N dias antes da data de referência (fim
// do período do relatório) entram na conta.
const JANELA_DIAS = 90;

const somarPorProduto = (itens) => {
  const mapa = new Map();

  for (const item of itens) {
    const produtoId = item.produtoId;
    const quantidade = Number(
      item.quantidadeRecebida ?? item.quantidade ?? 0,
    );
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue;

    const valorTotalItem =
      item.valorTotal !== null && item.valorTotal !== undefined
        ? Number(item.valorTotal)
        : quantidade * Number(item.valorUnitario || 0);

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
        attributes: [],
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

  const [itensJanela, itensTodos, produtos] = await Promise.all([
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
  ]);

  const mapaJanela = somarPorProduto(itensJanela);
  const mapaTodos = somarPorProduto(itensTodos);
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
