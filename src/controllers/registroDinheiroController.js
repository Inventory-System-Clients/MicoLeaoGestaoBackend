import RegistroDinheiro from "../models/RegistroDinheiro.js";
import { Op, fn, col, cast, where as sequelizeWhere } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  GastoVariavel,
  GastoTotalFixoLoja,
  GastoFixoLoja,
  MovimentacaoProduto,
  Movimentacao,
  Maquina,
  Produto,
  Loja,
  Usuario,
} from "../models/index.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

const listaMesesNoIntervalo = (inicio, fim) => {
  const meses = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);

  while (cursor <= limite) {
    meses.push({ ano: cursor.getFullYear(), mes: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses;
};

const normalizarValorMonetario = (valor) => {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  const valorNormalizado = String(valor)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  const numero = Number(valorNormalizado);
  return Number.isFinite(numero) ? numero : 0;
};

const normalizarNomeGasto = (nomeOriginal) =>
  String(nomeOriginal || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const consolidarGastosFixosPorNome = (gastos) => {
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

const calcularTotalFixoAtualDaLoja = async (lojaId) => {
  const gastos = await GastoFixoLoja.findAll({
    where: {
      [Op.and]: [sequelizeWhere(cast(col("lojaid"), "text"), String(lojaId))],
    },
    attributes: ["id", "nome", "valor"],
    order: [["id", "ASC"]],
    raw: true,
  });

  const gastosConsolidados = consolidarGastosFixosPorNome(gastos);

  const total = gastosConsolidados.reduce(
    (acc, item) => acc + calcularValorMensalDoGastoFixo(item),
    0,
  );

  return Number(total.toFixed(2));
};

const obterTotaisFixosMensais = async (lojaId, mesesIntervalo) => {
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

  const totalAtual = await calcularTotalFixoAtualDaLoja(lojaId);

  // Atualizamos apenas o mês corrente no banco; para meses antigos, não
  // sobrescrevemos valores históricos com o total atual.
  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;

  for (const item of mesesIntervalo) {
    const chave = `${item.ano}-${String(item.mes).padStart(2, "0")}`;
    const valorSalvo = mapa.has(chave) ? Number(mapa.get(chave) || 0) : null;

    if (valorSalvo === null) {
      if (item.ano === anoAtual && item.mes === mesAtual) {
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
            "[RegistroDinheiro] Falha ao persistir total fixo do mês corrente:",
            error.message,
          );
          mapa.set(chave, 0);
        }
      } else {
        mapa.set(chave, 0);
      }
    } else {
      // Mantém o valor salvo para cálculo proporcional
      mapa.set(chave, valorSalvo);
    }
  }

  return mapa;
};

const calcularGastoFixoProporcional = async (lojaId, inicio, fim) => {
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

const calcularGastoVariavelPeriodo = async (lojaId, inicio, fim) => {
  const total = await GastoVariavel.sum("valor", {
    where: {
      [Op.and]: [sequelizeWhere(cast(col("lojaId"), "text"), String(lojaId))],
      dataInicio: { [Op.lte]: fim },
      dataFim: { [Op.gte]: inicio },
    },
  });

  return Number(total || 0);
};

const calcularGastoProdutosSaidaPeriodo = async (lojaId, inicio, fim) => {
  const itensVendidos = await MovimentacaoProduto.findAll({
    attributes: ["quantidadeSaiu"],
    include: [
      {
        model: Produto,
        as: "produto",
        attributes: ["custoUnitario", "preco"],
      },
      {
        model: Movimentacao,
        attributes: [],
        required: true,
        where: {
          dataColeta: { [Op.between]: [inicio, fim] },
        },
        include: [
          {
            model: Maquina,
            as: "maquina",
            attributes: [],
            required: true,
            where: { lojaId },
          },
        ],
      },
    ],
    raw: true,
    nest: true,
  });

  const custoTotal = itensVendidos.reduce((acc, item) => {
    const qtd = Number(item.quantidadeSaiu || 0);
    if (qtd <= 0) return acc;

    const custoUnitario = Number(item.produto?.custoUnitario || 0);
    const precoFallback = Number(item.produto?.preco || 0);
    const custo = custoUnitario > 0 ? custoUnitario : precoFallback;

    return acc + qtd * custo;
  }, 0);

  return Number(custoTotal.toFixed(2));
};

const calcularGastosPeriodo = async (lojaId, inicio, fim) => {
  const [gastoFixoPeriodo, gastoVariavelPeriodo, gastoProdutosPeriodo] =
    await Promise.all([
      calcularGastoFixoProporcional(lojaId, inicio, fim),
      calcularGastoVariavelPeriodo(lojaId, inicio, fim),
      calcularGastoProdutosSaidaPeriodo(lojaId, inicio, fim),
    ]);

  const gastoTotalPeriodo = Number(
    (gastoFixoPeriodo + gastoVariavelPeriodo + gastoProdutosPeriodo).toFixed(2),
  );

  return {
    gastoFixoPeriodo,
    gastoVariavelPeriodo,
    gastoProdutosPeriodo,
    gastoTotalPeriodo,
  };
};

// Valor esperado pelo sistema: fichas das movimentações do período x valor
// da ficha de cada máquina (já calculado por movimentação em `valorFaturado`).
const calcularValorEsperadoSistema = async ({
  lojaId,
  maquinaId,
  registrarTotalLoja,
  inicio,
  fim,
}) => {
  let maquinaIds = [];

  if (registrarTotalLoja) {
    const maquinas = await Maquina.findAll({
      where: { lojaId },
      attributes: ["id"],
      raw: true,
    });
    maquinaIds = maquinas.map((maquina) => maquina.id);
  } else if (maquinaId) {
    maquinaIds = [maquinaId];
  }

  if (maquinaIds.length === 0) return 0;

  const total = await Movimentacao.sum("valorFaturado", {
    where: {
      maquinaId: { [Op.in]: maquinaIds },
      dataColeta: { [Op.between]: [inicio, fim] },
    },
  });

  return Number(total || 0);
};

const includeRegistro = [
  { model: Loja, as: "loja", attributes: ["id", "nome"] },
  { model: Maquina, as: "maquina", attributes: ["id", "codigo", "nome"] },
  { model: Usuario, as: "contadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "conferidoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "alertaBlinkResolvidoPor", attributes: ["id", "nome"] },
];

const registroDinheiroController = {
  async criar(req, res) {
    try {
      const {
        loja,
        maquina,
        registrarTotalLoja,
        inicio,
        fim,
        valorDinheiro,
        valorCartaoPix,
        valorBlink,
        percentualTaxaCartaoMedia,
        observacoes,
        conferidoPorId,
        comprovanteUrl,
        gastosVariaveis = [],
      } = req.body;

      const ehRegistroTotalLoja = !!registrarTotalLoja;

      console.log("[RegistrarDinheiro] Dados recebidos:", req.body);

      if (!loja || !inicio || !fim) {
        console.error("[RegistrarDinheiro] Campos obrigatórios ausentes");
        return res
          .status(400)
          .json({ error: "Campos obrigatórios ausentes: loja, início e fim." });
      }

      const inicioPeriodo = new Date(inicio);
      const fimPeriodo = new Date(fim);

      if (
        Number.isNaN(inicioPeriodo.getTime()) ||
        Number.isNaN(fimPeriodo.getTime())
      ) {
        return res.status(400).json({ error: "Período inválido." });
      }

      if (fimPeriodo < inicioPeriodo) {
        return res
          .status(400)
          .json({ error: "Data fim não pode ser menor que data início." });
      }

      if (conferidoPorId) {
        const conferente = await Usuario.findOne({
          where: { id: conferidoPorId, ativo: true },
        });
        if (!conferente) {
          return res
            .status(400)
            .json({
              error: "Usuário informado em 'quem conferiu' inválido ou inativo",
            });
        }
      }

      if (!Array.isArray(gastosVariaveis)) {
        return res
          .status(400)
          .json({ error: "gastosVariaveis deve ser um array." });
      }

      const gastosVariaveisNormalizados = gastosVariaveis
        .map((item) => ({
          nome: String(item?.nome || "").trim(),
          valor: normalizarValorMonetario(item?.valor),
          observacao: item?.observacao ? String(item.observacao).trim() : null,
        }))
        .filter((item) => item.nome.length > 0);

      const totalGastosVariaveisNovos = ehRegistroTotalLoja
        ? gastosVariaveisNormalizados.reduce(
            (acc, item) => acc + Number(item.valor || 0),
            0,
          )
        : 0;

      const gastosPeriodo = ehRegistroTotalLoja
        ? await calcularGastosPeriodo(
            loja,
            inicioDoDia(inicioPeriodo),
            fimDoDia(fimPeriodo),
          )
        : {
            gastoFixoPeriodo: 0,
            gastoVariavelPeriodo: 0,
            gastoProdutosPeriodo: 0,
            gastoTotalPeriodo: 0,
          };

      const gastoVariavelPeriodoFinal = Number(
        (
          gastosPeriodo.gastoVariavelPeriodo + totalGastosVariaveisNovos
        ).toFixed(2),
      );
      const gastoTotalPeriodoFinal = Number(
        (
          gastosPeriodo.gastoFixoPeriodo +
          gastoVariavelPeriodoFinal +
          gastosPeriodo.gastoProdutosPeriodo
        ).toFixed(2),
      );

      const valorCartaoPixNumero = normalizarValorMonetario(valorCartaoPix);
      const percentualTaxaCartaoMediaNumero = Math.max(
        normalizarValorMonetario(percentualTaxaCartaoMedia),
        0,
      );
      const taxaDeCartao = Number(
        (
          valorCartaoPixNumero *
          (Math.min(percentualTaxaCartaoMediaNumero, 100) / 100)
        ).toFixed(2),
      );
      const valorCartaoPixLiquidoNumero = Number(
        Math.max(valorCartaoPixNumero - taxaDeCartao, 0).toFixed(2),
      );

      const valorDinheiroNumero = normalizarValorMonetario(valorDinheiro);
      const blinkFornecido =
        valorBlink !== undefined && valorBlink !== null && valorBlink !== "";
      const valorBlinkNumero = normalizarValorMonetario(valorBlink);

      const valorEsperadoSistema = await calcularValorEsperadoSistema({
        lojaId: loja,
        maquinaId: ehRegistroTotalLoja ? null : maquina || null,
        registrarTotalLoja: ehRegistroTotalLoja,
        inicio: inicioPeriodo,
        fim: fimPeriodo,
      });

      // Blink é só um valor de comparação (trocadora), não entra na soma
      // contada contra o valor esperado pelo sistema (fichas).
      const valorContadoTotal = valorDinheiroNumero + valorCartaoPixNumero;
      const diferenca = Number(
        (valorContadoTotal - valorEsperadoSistema).toFixed(2),
      );

      // Divergência Blink: só faz sentido pro fechamento de total da loja,
      // e só se o Blink foi de fato informado.
      const diferencaBlink =
        ehRegistroTotalLoja && blinkFornecido
          ? Number((valorContadoTotal - valorBlinkNumero).toFixed(2))
          : null;

      const dadosRegistro = {
        lojaId: loja,
        maquinaId: ehRegistroTotalLoja ? null : maquina || null,
        registrarTotalLoja: ehRegistroTotalLoja,
        inicio,
        fim,
        valorDinheiro: valorDinheiroNumero,
        valorCartaoPix: valorCartaoPixNumero,
        valorCartaoPixLiquido: valorCartaoPixLiquidoNumero,
        taxaDeCartao,
        percentualTaxaCartaoMedia: percentualTaxaCartaoMediaNumero,
        valorBlink: valorBlinkNumero,
        valorEsperadoSistema: Number(valorEsperadoSistema.toFixed(2)),
        diferenca,
        diferencaBlink,
        contadoPorId: req.usuario.id,
        conferidoPorId: conferidoPorId || null,
        comprovanteUrl: comprovanteUrl || null,
        gastoFixoPeriodo: ehRegistroTotalLoja
          ? gastosPeriodo.gastoFixoPeriodo
          : 0,
        gastoVariavelPeriodo: ehRegistroTotalLoja
          ? gastoVariavelPeriodoFinal
          : 0,
        gastoProdutosPeriodo: ehRegistroTotalLoja
          ? gastosPeriodo.gastoProdutosPeriodo
          : 0,
        gastoTotalPeriodo: ehRegistroTotalLoja ? gastoTotalPeriodoFinal : 0,
        observacoes,
      };

      const transaction = await sequelize.transaction();

      try {
        const registro = await RegistroDinheiro.create(dadosRegistro, {
          fields: [
            "lojaId",
            "maquinaId",
            "registrarTotalLoja",
            "inicio",
            "fim",
            "valorDinheiro",
            "valorCartaoPix",
            "valorCartaoPixLiquido",
            "taxaDeCartao",
            "percentualTaxaCartaoMedia",
            "gastoFixoPeriodo",
            "gastoVariavelPeriodo",
            "gastoProdutosPeriodo",
            "gastoTotalPeriodo",
            "observacoes",
            "valorBlink",
            "valorEsperadoSistema",
            "diferenca",
            "diferencaBlink",
            "contadoPorId",
            "conferidoPorId",
            "comprovanteUrl",
          ],
          transaction,
        });

        if (ehRegistroTotalLoja && gastosVariaveisNormalizados.length > 0) {
          const payloadGastosVariaveis = gastosVariaveisNormalizados.map(
            (item) => ({
              lojaId: loja,
              nome: item.nome,
              valor: item.valor,
              observacao: item.observacao,
              dataInicio: inicio,
              dataFim: fim,
              registroDinheiroId: registro.id,
            }),
          );

          await GastoVariavel.bulkCreate(payloadGastosVariaveis, {
            transaction,
          });
        }

        await transaction.commit();

        const registroCompleto = await RegistroDinheiro.findByPk(registro.id, {
          include: includeRegistro,
        });

        return res.status(201).json(registroCompleto);
      } catch (dbError) {
        await transaction.rollback();
        throw dbError;
      }
    } catch (err) {
      console.error("[RegistrarDinheiro] Erro inesperado:", err);
      return res
        .status(500)
        .json({ error: "Erro ao registrar dinheiro", details: err.message });
    }
  },

  async listar(req, res) {
    try {
      const {
        lojaId,
        maquinaId,
        registrarTotalLoja,
        conferidoPorId,
        contadoPorId,
        dataInicio,
        dataFim,
        limite = 100,
      } = req.query;

      const where = {};
      if (lojaId) where.lojaId = lojaId;
      if (maquinaId) where.maquinaId = maquinaId;
      if (registrarTotalLoja === "true") where.registrarTotalLoja = true;
      if (registrarTotalLoja === "false") where.registrarTotalLoja = false;
      if (conferidoPorId) where.conferidoPorId = conferidoPorId;
      if (contadoPorId) where.contadoPorId = contadoPorId;

      if (dataInicio || dataFim) {
        where.fim = {};
        if (dataInicio) {
          where.fim[Op.gte] = new Date(`${dataInicio}T00:00:00.000-03:00`);
        }
        if (dataFim) {
          where.fim[Op.lte] = new Date(`${dataFim}T23:59:59.999-03:00`);
        }
      }

      const registros = await RegistroDinheiro.findAll({
        where,
        order: [["fim", "DESC"]],
        limit: Math.min(parseInt(limite, 10) || 100, 500),
        include: includeRegistro,
      });
      return res.json(registros);
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Erro ao buscar registros", details: err.message });
    }
  },

  async listarAlertasBlink(req, res) {
    try {
      const registros = await RegistroDinheiro.findAll({
        where: {
          registrarTotalLoja: true,
          diferencaBlink: { [Op.ne]: null },
          alertaBlinkResolvidoEm: null,
        },
        order: [["fim", "DESC"]],
        include: includeRegistro,
      });

      const divergentes = registros.filter(
        (registro) => Math.abs(Number(registro.diferencaBlink)) >= 0.01,
      );

      return res.json(divergentes);
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao buscar alertas de divergência do Blink",
        details: err.message,
      });
    }
  },

  async resolverAlertaBlink(req, res) {
    try {
      const registro = await RegistroDinheiro.findByPk(req.params.id);
      if (!registro) {
        return res.status(404).json({ error: "Registro não encontrado" });
      }

      await registro.update({
        alertaBlinkResolvidoEm: new Date(),
        alertaBlinkResolvidoPorId: req.usuario.id,
      });

      const registroCompleto = await RegistroDinheiro.findByPk(registro.id, {
        include: includeRegistro,
      });
      return res.json(registroCompleto);
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao resolver alerta de divergência do Blink",
        details: err.message,
      });
    }
  },

  async ultimoFechamento(req, res) {
    try {
      const { lojaId, maquinaId, registrarTotalLoja } = req.query;

      if (!lojaId) {
        return res.status(400).json({ error: "lojaId é obrigatório" });
      }

      const where = { lojaId };
      if (registrarTotalLoja === "true") {
        where.registrarTotalLoja = true;
      } else if (maquinaId) {
        where.maquinaId = maquinaId;
      } else {
        return res.json({ ultimoFim: null });
      }

      const ultimoRegistro = await RegistroDinheiro.findOne({
        where,
        order: [["fim", "DESC"]],
      });

      return res.json({
        ultimoFim: ultimoRegistro ? ultimoRegistro.fim : null,
      });
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao buscar último fechamento",
        details: err.message,
      });
    }
  },

  async valorEsperado(req, res) {
    try {
      const { lojaId, maquinaId, registrarTotalLoja, inicio, fim } = req.query;

      if (!lojaId || !inicio || !fim) {
        return res
          .status(400)
          .json({ error: "lojaId, inicio e fim são obrigatórios" });
      }

      const inicioPeriodo = new Date(inicio);
      const fimPeriodo = new Date(fim);

      if (
        Number.isNaN(inicioPeriodo.getTime()) ||
        Number.isNaN(fimPeriodo.getTime())
      ) {
        return res.status(400).json({ error: "Período inválido" });
      }

      const valorEsperadoSistema = await calcularValorEsperadoSistema({
        lojaId,
        maquinaId: maquinaId || null,
        registrarTotalLoja: registrarTotalLoja === "true",
        inicio: inicioPeriodo,
        fim: fimPeriodo,
      });

      return res.json({
        valorEsperadoSistema: Number(valorEsperadoSistema.toFixed(2)),
      });
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao calcular valor esperado",
        details: err.message,
      });
    }
  },
};

export default registroDinheiroController;
