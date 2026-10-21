import { CotacaoMoeda } from "../models/index.js";

// Cotação usada enquanto ninguém cadastrou nenhuma em Financeiro >
// Configuração de moeda (também é gravada como primeira linha no start).
export const COTACAO_DOLAR_PADRAO = 5;

// Histórico de cotações da moeda em ordem crescente de vigência.
export const buscarHistoricoCotacao = async (moeda = "USD", transaction) => {
  const linhas = await CotacaoMoeda.findAll({
    where: { moeda },
    attributes: ["valorEmReal", "vigenteDesde"],
    order: [["vigenteDesde", "ASC"]],
    raw: true,
    transaction,
  });
  return linhas.map((linha) => ({
    valorEmReal: Number(linha.valorEmReal),
    vigenteDesde: new Date(linha.vigenteDesde),
  }));
};

// Cotação que valia na data informada. Antes da primeira cotação cadastrada,
// usa a mais antiga; sem nenhuma cadastrada, usa o padrão.
export const cotacaoNaData = (historico, data = new Date()) => {
  if (!historico || historico.length === 0) return COTACAO_DOLAR_PADRAO;
  const momento = new Date(data).getTime();
  let cotacao = historico[0].valorEmReal;
  for (const item of historico) {
    if (item.vigenteDesde.getTime() > momento) break;
    cotacao = item.valorEmReal;
  }
  return cotacao;
};

// Converte um valor da moeda pra real, na cotação da data. BRL volta igual.
export const converterParaReal = (valor, moeda, historico, data) => {
  const numero = Number(valor || 0);
  if (!moeda || moeda === "BRL") return numero;
  return Number((numero * cotacaoNaData(historico, data)).toFixed(2));
};
