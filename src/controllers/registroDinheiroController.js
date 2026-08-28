import RegistroDinheiro from "../models/RegistroDinheiro.js";
import { Op, fn, col, cast, where as sequelizeWhere } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  GastoVariavel,
  MovimentacaoProduto,
  Movimentacao,
  Maquina,
  Loja,
  Usuario,
} from "../models/index.js";
import { calcularGastoFixoProporcionalPeriodo } from "../services/gastoFixoService.js";
import { calcularCustoMedioProdutos } from "../services/custoProdutoService.js";

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

const normalizarInteiro = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(String(valor).replace(/\D/g, ""));
  return Number.isFinite(numero) ? numero : null;
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
    attributes: ["produtoId", "quantidadeSaiu"],
    include: [
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

  const produtoIds = itensVendidos
    .filter((item) => Number(item.quantidadeSaiu || 0) > 0)
    .map((item) => item.produtoId);

  const custoMedioPorProduto = await calcularCustoMedioProdutos(
    produtoIds,
    fim,
  );

  const custoTotal = itensVendidos.reduce((acc, item) => {
    const qtd = Number(item.quantidadeSaiu || 0);
    if (qtd <= 0) return acc;

    const custoMedio = Number(custoMedioPorProduto.get(item.produtoId) || 0);
    return acc + qtd * custoMedio;
  }, 0);

  return Number(custoTotal.toFixed(2));
};

const calcularGastosPeriodo = async (lojaId, inicio, fim) => {
  const [gastoFixoPeriodo, gastoVariavelPeriodo, gastoProdutosPeriodo] =
    await Promise.all([
      calcularGastoFixoProporcionalPeriodo(lojaId, inicio, fim),
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

// Quantidade de fichas esperada pelo sistema para comparar com a leitura da
// Blink: soma das fichas coletadas nas máquinas geradoras de receita da loja,
// exceto as máquinas Cascata (não contabilizam fichas nessa comparação).
const calcularQuantidadeFichasSistema = async ({ lojaId, inicio, fim }) => {
  const maquinas = await Maquina.findAll({
    where: { lojaId, geradoraReceita: true },
    attributes: ["id", "nome", "tipo"],
    raw: true,
  });

  const ehCascata = (maquina) =>
    String(maquina.tipo || "").trim().toLowerCase().includes("cascata") ||
    String(maquina.nome || "").trim().toLowerCase().includes("cascata");

  const maquinaIds = maquinas
    .filter((maquina) => !ehCascata(maquina))
    .map((maquina) => maquina.id);

  if (maquinaIds.length === 0) return 0;

  const total = await Movimentacao.sum("fichas", {
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
  {
    model: Usuario,
    as: "alertaFichasBlinkResolvidoPor",
    attributes: ["id", "nome"],
  },
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
        quantidadeFichasBlink,
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

      const fichasBlinkFornecido =
        quantidadeFichasBlink !== undefined &&
        quantidadeFichasBlink !== null &&
        quantidadeFichasBlink !== "";
      const quantidadeFichasBlinkNumero = normalizarInteiro(
        quantidadeFichasBlink,
      );

      const valorEsperadoSistema = await calcularValorEsperadoSistema({
        lojaId: loja,
        maquinaId: ehRegistroTotalLoja ? null : maquina || null,
        registrarTotalLoja: ehRegistroTotalLoja,
        inicio: inicioPeriodo,
        fim: fimPeriodo,
      });

      // Fichas esperadas pelo sistema (máquinas geradoras de receita, exceto
      // Cascata) só fazem sentido pro fechamento de total da loja.
      const quantidadeFichasSistema = ehRegistroTotalLoja
        ? await calcularQuantidadeFichasSistema({
            lojaId: loja,
            inicio: inicioPeriodo,
            fim: fimPeriodo,
          })
        : 0;

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

      // Divergência de fichas do Blink: sistema x leitura manual da Blink,
      // só pro fechamento de total da loja e só se foi informada.
      const diferencaFichasBlink =
        ehRegistroTotalLoja &&
        fichasBlinkFornecido &&
        quantidadeFichasBlinkNumero !== null
          ? quantidadeFichasSistema - quantidadeFichasBlinkNumero
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
        quantidadeFichasBlink: quantidadeFichasBlinkNumero,
        quantidadeFichasSistema: ehRegistroTotalLoja
          ? quantidadeFichasSistema
          : null,
        diferencaFichasBlink,
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
            "quantidadeFichasBlink",
            "quantidadeFichasSistema",
            "diferencaFichasBlink",
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

  async listarAlertasFichasBlink(req, res) {
    try {
      const registros = await RegistroDinheiro.findAll({
        where: {
          registrarTotalLoja: true,
          diferencaFichasBlink: { [Op.ne]: null },
          alertaFichasBlinkResolvidoEm: null,
        },
        order: [["fim", "DESC"]],
        include: includeRegistro,
      });

      const divergentes = registros.filter(
        (registro) => Number(registro.diferencaFichasBlink) !== 0,
      );

      return res.json(divergentes);
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao buscar alertas de divergência de fichas do Blink",
        details: err.message,
      });
    }
  },

  async resolverAlertaFichasBlink(req, res) {
    try {
      const registro = await RegistroDinheiro.findByPk(req.params.id);
      if (!registro) {
        return res.status(404).json({ error: "Registro não encontrado" });
      }

      await registro.update({
        alertaFichasBlinkResolvidoEm: new Date(),
        alertaFichasBlinkResolvidoPorId: req.usuario.id,
      });

      const registroCompleto = await RegistroDinheiro.findByPk(registro.id, {
        include: includeRegistro,
      });
      return res.json(registroCompleto);
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao resolver alerta de divergência de fichas do Blink",
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

      const ehRegistroTotalLoja = registrarTotalLoja === "true";

      const [valorEsperadoSistema, quantidadeFichasSistema] =
        await Promise.all([
          calcularValorEsperadoSistema({
            lojaId,
            maquinaId: maquinaId || null,
            registrarTotalLoja: ehRegistroTotalLoja,
            inicio: inicioPeriodo,
            fim: fimPeriodo,
          }),
          ehRegistroTotalLoja
            ? calcularQuantidadeFichasSistema({
                lojaId,
                inicio: inicioPeriodo,
                fim: fimPeriodo,
              })
            : Promise.resolve(null),
        ]);

      return res.json({
        valorEsperadoSistema: Number(valorEsperadoSistema.toFixed(2)),
        quantidadeFichasSistema,
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
