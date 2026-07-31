import { Op, cast, col, where as sequelizeWhere } from "sequelize";
import { GastoFixoLoja, GastoTotalFixoLoja } from "../models/index.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const normalizarNomeGasto = (nomeOriginal) =>
  String(nomeOriginal || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const consolidarGastosFixosPorNome = (gastos) => {
  const mapa = new Map();

  for (const gasto of gastos) {
    const chave = normalizarNomeGasto(gasto?.nome);
    if (!chave) continue;
    mapa.set(chave, gasto);
  }

  return Array.from(mapa.values());
};

const calcularValorMensalDoGastoFixo = (gasto) => {
  const valor = Number(gasto?.valor || 0);
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return valor;
};

// Soma dos gastos fixos configurados HOJE pra loja (o que está salvo na
// tela de "Gastos Fixos" agora, sem noção de histórico).
export const calcularTotalFixoAtualDaLoja = async (lojaId, transaction) => {
  const gastos = await GastoFixoLoja.findAll({
    where: {
      [Op.and]: [sequelizeWhere(cast(col("lojaid"), "text"), String(lojaId))],
    },
    attributes: ["id", "nome", "valor"],
    order: [["id", "ASC"]],
    raw: true,
    transaction,
  });

  const gastosConsolidados = consolidarGastosFixosPorNome(gastos);
  const total = gastosConsolidados.reduce(
    (acc, item) => acc + calcularValorMensalDoGastoFixo(item),
    0,
  );

  return Number(total.toFixed(2));
};

const diasNoMes = (ano, mes) => new Date(ano, mes, 0).getDate();

const inicioDoDia = (data) =>
  new Date(data.getFullYear(), data.getMonth(), data.getDate(), 0, 0, 0, 0);

const fimDoDia = (data) =>
  new Date(
    data.getFullYear(),
    data.getMonth(),
    data.getDate(),
    23,
    59,
    59,
    999,
  );

export const listaMesesNoIntervalo = (inicio, fim) => {
  const meses = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);

  while (cursor <= limite) {
    meses.push({ ano: cursor.getFullYear(), mes: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses;
};

// Total fixo HISTÓRICO salvo de cada mês do intervalo (snapshot em
// gastos_totais_fixos_loja). Nunca sobrescreve um mês que já tem snapshot —
// só "semeia" o mês corrente com o total atual na primeira vez que for
// consultado (ainda não existe snapshot dele). Meses passados sem snapshot
// (loja nunca tinha configurado gasto fixo naquela época) ficam em 0.
//
// Importante: esta função é usada tanto ao gerar relatórios quanto ao
// registrar dinheiro — ela só LÊ o histórico, nunca reescreve um mês já
// fechado com o valor atual. Antes, uma versão duplicada em
// relatorioController.js fazia isso errado e corrompia o histórico toda vez
// que alguém abria um relatório de um mês passado.
export const obterTotaisFixosMensais = async (lojaId, mesesIntervalo) => {
  if (!mesesIntervalo.length) return new Map();

  const totais = await GastoTotalFixoLoja.findAll({
    where: {
      [Op.and]: [sequelizeWhere(cast(col("lojaid"), "text"), String(lojaId))],
      [Op.or]: mesesIntervalo.map((m) => ({ ano: m.ano, mes: m.mes })),
    },
    raw: true,
  });

  const mapa = new Map(
    totais.map((item) => [
      `${item.ano}-${String(item.mes).padStart(2, "0")}`,
      Number(item.valorTotal || 0),
    ]),
  );

  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;
  let totalAtual = null;

  for (const item of mesesIntervalo) {
    const chave = `${item.ano}-${String(item.mes).padStart(2, "0")}`;
    if (mapa.has(chave)) continue;

    if (item.ano === anoAtual && item.mes === mesAtual) {
      if (totalAtual === null) {
        totalAtual = await calcularTotalFixoAtualDaLoja(lojaId);
      }
      try {
        await GastoTotalFixoLoja.upsert({
          lojaId,
          ano: item.ano,
          mes: item.mes,
          valorTotal: totalAtual,
        });
        mapa.set(chave, totalAtual);
      } catch (error) {
        console.warn(
          "[GastoFixo] Falha ao semear total fixo do mês corrente:",
          error.message,
        );
        mapa.set(chave, 0);
      }
    } else {
      mapa.set(chave, 0);
    }
  }

  return mapa;
};

// Rateia o total fixo mensal (histórico, mês a mês) proporcionalmente aos
// dias do período informado que caem em cada mês.
export const calcularGastoFixoProporcionalPeriodo = async (
  lojaId,
  inicio,
  fim,
) => {
  const mesesIntervalo = listaMesesNoIntervalo(inicio, fim);
  const totaisPorMes = await obterTotaisFixosMensais(lojaId, mesesIntervalo);

  let totalProporcional = 0;

  for (const { ano, mes } of mesesIntervalo) {
    const chave = `${ano}-${String(mes).padStart(2, "0")}`;
    const valorMensal = Number(totaisPorMes.get(chave) || 0);
    if (valorMensal <= 0) continue;

    const inicioMes = inicioDoDia(new Date(ano, mes - 1, 1));
    const fimMes = fimDoDia(new Date(ano, mes, 0));
    const inicioAplicado = inicio > inicioMes ? inicio : inicioMes;
    const fimAplicado = fim < fimMes ? fim : fimMes;

    if (inicioAplicado > fimAplicado) continue;

    const diasDoPeriodoNoMes =
      Math.floor(
        (inicioDoDia(fimAplicado).getTime() -
          inicioDoDia(inicioAplicado).getTime()) /
          DAY_IN_MS,
      ) + 1;

    totalProporcional +=
      (valorMensal / diasNoMes(ano, mes)) * diasDoPeriodoNoMes;
  }

  return Number(totalProporcional.toFixed(2));
};
