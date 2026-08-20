import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  Compra,
  CompraItem,
  CompraCustoAdicional,
  ContaPagar,
  EstoqueLoja,
  Fornecedor,
  Insumo,
  Loja,
  Peca,
  Produto,
  Usuario,
} from "../models/index.js";
import { obterOuCriarEstoqueCentral } from "./movimentacaoEstoqueLojaController.js";

const STATUS_VALIDOS = ["PESQUISANDO", "COMPRADO", "RECEBIDO"];
const MOEDAS_VALIDAS = ["BRL", "USD"];
const TIPOS_PAGAMENTO_VALIDOS = ["ANTECIPADO", "PARCELADO", "A_VISTA"];
const FORMAS_PAGAMENTO_VALIDAS = ["PIX", "DINHEIRO", "BOLETO"];
const TIPOS_DESCONTO_VALIDOS = ["PERCENTUAL", "FIXO"];
const TIPOS_VALOR_CUSTO_VALIDOS = ["FIXO", "PERCENTUAL"];
const BASES_CALCULO_VALIDAS = ["SEM_DESCONTO", "COM_DESCONTO"];

class ErroValidacaoCompra extends Error {}

const normalizarStatusCompra = (status) =>
  status === "APROVADO" ? "COMPRADO" : status;

const includeItens = {
  model: CompraItem,
  as: "itens",
  include: [
    { model: Produto, as: "produto", attributes: ["id", "codigo", "nome"] },
    { model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] },
    { model: Peca, as: "peca", attributes: ["id", "codigo", "nome", "unidade"] },
    { model: Loja, as: "loja", attributes: ["id", "nome"] },
  ],
};

const includeCompra = [
  { model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "comprador", attributes: ["id", "nome"] },
  { model: Usuario, as: "recebidoPor", attributes: ["id", "nome"] },
  includeItens,
  { model: CompraCustoAdicional, as: "custosAdicionais" },
  { model: ContaPagar, as: "contasPagar", attributes: ["id", "status"] },
];

const calcularValorTotal = (quantidade, valorUnitario, valorTotalInformado) => {
  if (valorTotalInformado !== undefined && valorTotalInformado !== null && valorTotalInformado !== "") {
    return Number(valorTotalInformado);
  }
  if (valorUnitario !== undefined && valorUnitario !== null && valorUnitario !== "") {
    return Number((Number(valorUnitario) * Number(quantidade)).toFixed(2));
  }
  return null;
};

const calcularValorDesconto = (valorTotalPedido, descontoTipo, descontoValor) => {
  if (!descontoTipo || !descontoValor) return 0;
  const valor =
    descontoTipo === "PERCENTUAL"
      ? (valorTotalPedido * Number(descontoValor)) / 100
      : Number(descontoValor);
  return Number(Math.min(Math.max(valor, 0), valorTotalPedido).toFixed(2));
};

const comAgregados = (compra) => {
  const plain = compra.toJSON ? compra.toJSON() : compra;
  const moedaPedido = plain.moeda || "BRL";

  const valorTotalPedido = Number(
    (plain.itens || [])
      .reduce((acc, item) => acc + Number(item.valorTotal || 0), 0)
      .toFixed(2),
  );

  const valorDesconto = calcularValorDesconto(
    valorTotalPedido,
    plain.descontoTipo,
    plain.descontoValor,
  );
  const valorItensComDesconto = Number((valorTotalPedido - valorDesconto).toFixed(2));

  const custosPorMoeda = {};
  const custosAdicionaisComValor = (plain.custosAdicionais || []).map((custo) => {
    const moedaCusto = custo.moeda || moedaPedido;
    let valorCalculado;
    if (custo.tipoValor === "PERCENTUAL") {
      const base = custo.baseCalculo === "COM_DESCONTO" ? valorItensComDesconto : valorTotalPedido;
      valorCalculado = Number(((base * Number(custo.valor || 0)) / 100).toFixed(2));
    } else {
      valorCalculado = Number(Number(custo.valor || 0).toFixed(2));
    }
    custosPorMoeda[moedaCusto] = Number(
      ((custosPorMoeda[moedaCusto] || 0) + valorCalculado).toFixed(2),
    );
    return { ...custo, valorCalculado };
  });

  const valorCustosAdicionais = custosPorMoeda[moedaPedido] || 0;
  const valorGeralPedido = Number((valorItensComDesconto + valorCustosAdicionais).toFixed(2));
  const custosAdicionaisOutrasMoedas = Object.entries(custosPorMoeda)
    .filter(([moedaCusto]) => moedaCusto !== moedaPedido)
    .map(([moedaCusto, valor]) => ({ moeda: moedaCusto, valor }));

  return {
    ...plain,
    custosAdicionais: custosAdicionaisComValor,
    valorTotalPedido,
    valorDesconto,
    valorItensComDesconto,
    valorCustosAdicionais,
    valorGeralPedido,
    custosAdicionaisOutrasMoedas,
  };
};

const validarItem = async (item, transaction) => {
  const nomeItem = (item.nomeItem || "").trim();
  if (!nomeItem) {
    throw new ErroValidacaoCompra("Informe o nome de cada item do pedido");
  }

  let produtoId = item.produtoId || null;
  let insumoId = item.insumoId || null;
  let pecaId = item.pecaId || null;

  if ([produtoId, insumoId, pecaId].filter(Boolean).length > 1) {
    throw new ErroValidacaoCompra("Cada item deve ter no máximo um produto, insumo ou peça");
  }

  const quantidadeNumerica = Number(item.quantidade);
  if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
    throw new ErroValidacaoCompra(`Informe uma quantidade válida para "${nomeItem}"`);
  }

  const tipoItem =
    item.tipoItem || (produtoId ? "PRODUTO" : insumoId ? "INSUMO" : pecaId ? "PECA" : "PRODUTO");

  if (item.itemNovo && !produtoId && !insumoId && !pecaId) {
    if (tipoItem === "INSUMO") {
      const insumoCriado = await Insumo.create(
        {
          nome: nomeItem,
          unidade: item.unidade || null,
          custoUnitarioUltimo: item.valorUnitario || null,
        },
        { transaction },
      );
      insumoId = insumoCriado.id;
    } else if (tipoItem === "PECA") {
      const pecaCriada = await Peca.create(
        {
          codigo: item.sku || null,
          nome: nomeItem,
          custoUnitario: item.valorUnitario || null,
        },
        { transaction },
      );
      pecaId = pecaCriada.id;
    } else {
      const produtoCriado = await Produto.create(
        {
          codigo: item.sku || null,
          nome: nomeItem,
          custoUnitario: item.valorUnitario || null,
        },
        { transaction },
      );
      produtoId = produtoCriado.id;
    }
  } else {
    if (produtoId) {
      const produto = await Produto.findByPk(produtoId, { transaction });
      if (!produto) throw new ErroValidacaoCompra(`Produto informado não encontrado (${nomeItem})`);
    }
    if (insumoId) {
      const insumo = await Insumo.findByPk(insumoId, { transaction });
      if (!insumo) throw new ErroValidacaoCompra(`Insumo informado não encontrado (${nomeItem})`);
    }
    if (pecaId) {
      const peca = await Peca.findByPk(pecaId, { transaction });
      if (!peca) throw new ErroValidacaoCompra(`Peça informada não encontrada (${nomeItem})`);
    }
  }

  return {
    tipoItem,
    produtoId,
    insumoId,
    pecaId,
    nomeItem,
    sku: item.sku || null,
    quantidade: quantidadeNumerica,
    unidade: item.unidade || null,
    valorUnitario: item.valorUnitario || null,
    valorTotal: calcularValorTotal(quantidadeNumerica, item.valorUnitario, undefined),
    lojaId: item.lojaId || null,
    descricaoUso: item.descricaoUso || null,
  };
};

const validarCustoAdicional = (custo) => {
  const descricao = (custo.descricao || "").trim();
  if (!descricao) return null;

  const tipoValor = custo.tipoValor || "FIXO";
  if (!TIPOS_VALOR_CUSTO_VALIDOS.includes(tipoValor)) {
    throw new ErroValidacaoCompra(`Tipo de valor inválido para o custo adicional "${descricao}"`);
  }

  const valor = Number(custo.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroValidacaoCompra(`Informe um valor válido para o custo adicional "${descricao}"`);
  }
  if (tipoValor === "PERCENTUAL" && valor > 100) {
    throw new ErroValidacaoCompra(
      `A porcentagem do custo adicional "${descricao}" não pode passar de 100%`,
    );
  }

  const moedaCusto = custo.moeda || "BRL";
  if (!MOEDAS_VALIDAS.includes(moedaCusto)) {
    throw new ErroValidacaoCompra(`Moeda inválida para o custo adicional "${descricao}"`);
  }

  let baseCalculo = null;
  if (tipoValor === "PERCENTUAL") {
    baseCalculo = custo.baseCalculo || "SEM_DESCONTO";
    if (!BASES_CALCULO_VALIDAS.includes(baseCalculo)) {
      throw new ErroValidacaoCompra(`Base de cálculo inválida para o custo adicional "${descricao}"`);
    }
  }

  const formaPagamento = custo.formaPagamento;
  if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    throw new ErroValidacaoCompra(`Forma de pagamento inválida para o custo adicional "${descricao}"`);
  }

  return { descricao, tipoValor, valor, baseCalculo, moeda: moedaCusto, formaPagamento };
};

const validarDesconto = (descontoTipo, descontoValor) => {
  if (!descontoTipo) return { descontoTipo: null, descontoValor: null };

  if (!TIPOS_DESCONTO_VALIDOS.includes(descontoTipo)) {
    throw new ErroValidacaoCompra("Tipo de desconto inválido");
  }

  const valor = Number(descontoValor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroValidacaoCompra("Informe um valor válido para o desconto");
  }
  if (descontoTipo === "PERCENTUAL" && valor > 100) {
    throw new ErroValidacaoCompra("O desconto em percentual não pode passar de 100%");
  }

  return { descontoTipo, descontoValor: valor };
};

export const listarCompras = async (req, res) => {
  try {
    const {
      status,
      fornecedorId,
      lojaId,
      produto,
      dataInicio,
      dataFim,
      valorMin,
      valorMax,
    } = req.query;
    const where = {};

    if (status) {
      const statusLista = status.split(",").filter((s) => STATUS_VALIDOS.includes(s));
      if (statusLista.length > 0) {
        where.status = { [Op.in]: statusLista };
      }
    }

    if (fornecedorId) where.fornecedorId = fornecedorId;

    if (lojaId) where["$itens.lojaId$"] = lojaId;

    if (produto && produto.trim()) {
      const termo = `%${produto.trim()}%`;
      where[Op.or] = [
        { "$itens.nomeItem$": { [Op.iLike]: termo } },
        { "$itens.produto.nome$": { [Op.iLike]: termo } },
        { "$itens.insumo.nome$": { [Op.iLike]: termo } },
        { "$itens.peca.nome$": { [Op.iLike]: termo } },
      ];
    }

    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt[Op.gte] = new Date(`${dataInicio}T00:00:00.000-03:00`);
      }
      if (dataFim) {
        where.createdAt[Op.lte] = new Date(`${dataFim}T23:59:59.999-03:00`);
      }
    }

    let compras = await Compra.findAll({
      where,
      include: includeCompra,
      subQuery: false,
      distinct: true,
      order: [["createdAt", "DESC"]],
    });

    compras = compras.map(comAgregados);

    const valorMinNumero = Number(valorMin);
    const valorMaxNumero = Number(valorMax);
    if (valorMin !== undefined && valorMin !== "" && Number.isFinite(valorMinNumero)) {
      compras = compras.filter((compra) => compra.valorGeralPedido >= valorMinNumero);
    }
    if (valorMax !== undefined && valorMax !== "" && Number.isFinite(valorMaxNumero)) {
      compras = compras.filter((compra) => compra.valorGeralPedido <= valorMaxNumero);
    }

    res.json(compras);
  } catch (error) {
    console.error("Erro ao listar compras:", error);
    res.status(500).json({ error: "Erro ao listar compras" });
  }
};

export const criarCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      fornecedorId,
      numeroPedido,
      moeda,
      tipoPagamento,
      quantidadeParcelas,
      formaPagamento,
      fotoUrl,
      observacao,
      itens,
      custosAdicionais,
      descontoTipo,
      descontoValor,
    } = req.body;

    if (!Array.isArray(itens) || itens.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Adicione ao menos um item ao pedido" });
    }

    const moedaFinal = moeda || "BRL";
    if (!MOEDAS_VALIDAS.includes(moedaFinal)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Moeda inválida" });
    }

    if (tipoPagamento && !TIPOS_PAGAMENTO_VALIDOS.includes(tipoPagamento)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Tipo de pagamento inválido" });
    }

    if (formaPagamento && !FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Forma de pagamento inválida" });
    }

    let quantidadeParcelasFinal = null;
    if (tipoPagamento === "PARCELADO") {
      quantidadeParcelasFinal = Number(quantidadeParcelas);
      if (!Number.isInteger(quantidadeParcelasFinal) || quantidadeParcelasFinal < 2) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Informe a quantidade de parcelas (mínimo 2) para pagamento parcelado",
        });
      }
    }

    const itensValidados = [];
    for (const item of itens) {
      itensValidados.push(await validarItem(item, transaction));
    }

    const custosValidados = [];
    for (const custo of custosAdicionais || []) {
      const custoValidado = validarCustoAdicional(custo);
      if (custoValidado) custosValidados.push(custoValidado);
    }

    const descontoValidado = validarDesconto(descontoTipo, descontoValor);

    const compra = await Compra.create(
      {
        fornecedorId: fornecedorId || null,
        numeroPedido: numeroPedido?.trim() || null,
        moeda: moedaFinal,
        tipoPagamento: tipoPagamento || null,
        quantidadeParcelas: quantidadeParcelasFinal,
        formaPagamento: formaPagamento || null,
        fotoUrl: fotoUrl || null,
        observacao: observacao || null,
        descontoTipo: descontoValidado.descontoTipo,
        descontoValor: descontoValidado.descontoValor,
        criadoPorId: req.usuario.id,
      },
      { transaction },
    );

    await CompraItem.bulkCreate(
      itensValidados.map((item) => ({ ...item, compraId: compra.id })),
      { transaction },
    );

    if (custosValidados.length > 0) {
      await CompraCustoAdicional.bulkCreate(
        custosValidados.map((custo) => ({ ...custo, compraId: compra.id })),
        { transaction },
      );
    }

    await transaction.commit();

    const compraCompleta = await Compra.findByPk(compra.id, { include: includeCompra });

    res.locals.entityId = compra.id;
    res.status(201).json(comAgregados(compraCompleta));
  } catch (error) {
    await transaction.rollback();
    if (error instanceof ErroValidacaoCompra) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao criar compra:", error);
    res.status(500).json({ error: "Erro ao criar compra" });
  }
};

export const atualizarCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const compra = await Compra.findByPk(req.params.id, { transaction });

    if (!compra) {
      await transaction.rollback();
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    const {
      fornecedorId,
      numeroPedido,
      moeda,
      tipoPagamento,
      quantidadeParcelas,
      formaPagamento,
      fotoUrl,
      observacao,
      itens,
      custosAdicionais,
      descontoTipo,
      descontoValor,
    } = req.body;

    if (moeda !== undefined && !MOEDAS_VALIDAS.includes(moeda)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Moeda inválida" });
    }
    if (tipoPagamento !== undefined && tipoPagamento && !TIPOS_PAGAMENTO_VALIDOS.includes(tipoPagamento)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Tipo de pagamento inválido" });
    }
    if (formaPagamento !== undefined && formaPagamento && !FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Forma de pagamento inválida" });
    }

    if (
      (itens !== undefined ||
        custosAdicionais !== undefined ||
        descontoTipo !== undefined ||
        descontoValor !== undefined) &&
      compra.status !== "PESQUISANDO"
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Só é possível editar os itens de um pedido enquanto ele está em pesquisa",
      });
    }

    const descontoValidado =
      descontoTipo !== undefined || descontoValor !== undefined
        ? validarDesconto(
            descontoTipo !== undefined ? descontoTipo : compra.descontoTipo,
            descontoValor !== undefined ? descontoValor : compra.descontoValor,
          )
        : null;

    await compra.update(
      {
        fornecedorId: fornecedorId !== undefined ? fornecedorId || null : compra.fornecedorId,
        numeroPedido: numeroPedido !== undefined ? numeroPedido?.trim() || null : compra.numeroPedido,
        moeda: moeda !== undefined ? moeda : compra.moeda,
        tipoPagamento: tipoPagamento !== undefined ? tipoPagamento || null : compra.tipoPagamento,
        quantidadeParcelas:
          quantidadeParcelas !== undefined ? Number(quantidadeParcelas) || null : compra.quantidadeParcelas,
        formaPagamento: formaPagamento !== undefined ? formaPagamento || null : compra.formaPagamento,
        fotoUrl: fotoUrl !== undefined ? fotoUrl || null : compra.fotoUrl,
        observacao: observacao !== undefined ? observacao || null : compra.observacao,
        descontoTipo: descontoValidado ? descontoValidado.descontoTipo : compra.descontoTipo,
        descontoValor: descontoValidado ? descontoValidado.descontoValor : compra.descontoValor,
      },
      { transaction },
    );

    if (Array.isArray(itens)) {
      if (itens.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ error: "O pedido precisa de ao menos um item" });
      }
      const itensValidados = [];
      for (const item of itens) {
        itensValidados.push(await validarItem(item, transaction));
      }
      await CompraItem.destroy({ where: { compraId: compra.id }, transaction });
      await CompraItem.bulkCreate(
        itensValidados.map((item) => ({ ...item, compraId: compra.id })),
        { transaction },
      );
    }

    if (Array.isArray(custosAdicionais)) {
      const custosValidados = [];
      for (const custo of custosAdicionais) {
        const custoValidado = validarCustoAdicional(custo);
        if (custoValidado) custosValidados.push(custoValidado);
      }
      await CompraCustoAdicional.destroy({ where: { compraId: compra.id }, transaction });
      if (custosValidados.length > 0) {
        await CompraCustoAdicional.bulkCreate(
          custosValidados.map((custo) => ({ ...custo, compraId: compra.id })),
          { transaction },
        );
      }
    }

    await transaction.commit();

    const compraAtualizada = await Compra.findByPk(compra.id, { include: includeCompra });

    res.json(comAgregados(compraAtualizada));
  } catch (error) {
    await transaction.rollback();
    if (error instanceof ErroValidacaoCompra) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao atualizar compra:", error);
    res.status(500).json({ error: "Erro ao atualizar compra" });
  }
};

export const atualizarStatusCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { status } = req.body;

    if (!STATUS_VALIDOS.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Status inválido" });
    }

    const compra = await Compra.findByPk(req.params.id, {
      include: [{ model: CompraItem, as: "itens" }],
      transaction,
    });

    if (!compra) {
      await transaction.rollback();
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    if (compra.status === status) {
      await transaction.rollback();
      return res.status(400).json({ error: "A compra já está com este status" });
    }

    const statusAtual = normalizarStatusCompra(compra.status);
    const transicoesPermitidas = {
      PESQUISANDO: ["COMPRADO"],
      COMPRADO: [],
      RECEBIDO: [],
    };

    if (!transicoesPermitidas[statusAtual]?.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        error:
          status === "RECEBIDO"
            ? "Para dar como recebido é preciso conferir as quantidades de cada item"
            : "Nao e possivel voltar etapa ou pular o fluxo da compra",
      });
    }

    const dadosAtualizacao = { status };

    if (status === "COMPRADO") {
      dadosAtualizacao.dataCompra = compra.dataCompra || new Date();
      dadosAtualizacao.compradorId = compra.compradorId || req.usuario.id;
    }

    await compra.update(dadosAtualizacao, { transaction });

    await transaction.commit();

    const compraAtualizada = await Compra.findByPk(compra.id, { include: includeCompra });

    res.json(comAgregados(compraAtualizada));
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao atualizar status da compra:", error);
    res.status(500).json({ error: "Erro ao atualizar status da compra" });
  }
};

// Conferência de recebimento: registra quanto chegou de cada item e
// só marca a compra como pendente quando algo ficou faltando.
export const conferirRecebimentoCompra = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const compra = await Compra.findByPk(req.params.id, {
      include: [{ model: CompraItem, as: "itens" }],
      transaction,
    });

    if (!compra) {
      await transaction.rollback();
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    const statusAtual = normalizarStatusCompra(compra.status);
    const podeConferir =
      statusAtual === "COMPRADO" || (statusAtual === "RECEBIDO" && compra.possuiPendencia);

    if (!podeConferir) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Esta compra não está aguardando conferência de recebimento",
      });
    }

    const { itens } = req.body;
    if (!Array.isArray(itens) || itens.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Informe a quantidade recebida de cada item" });
    }

    const entradasPorId = new Map(itens.map((item) => [item.id, item]));

    for (const item of compra.itens) {
      if (!entradasPorId.has(item.id)) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Informe a quantidade recebida do item "${item.nomeItem}"`,
        });
      }
    }

    const estoqueCentral = await obterOuCriarEstoqueCentral(transaction);
    const itensAtualizados = [];

    for (const item of compra.itens) {
      const entrada = entradasPorId.get(item.id);
      const quantidadeRecebidaNova = Number(entrada.quantidadeRecebida);

      if (!Number.isFinite(quantidadeRecebidaNova) || quantidadeRecebidaNova < 0) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Informe uma quantidade recebida válida para "${item.nomeItem}"`,
        });
      }

      const quantidadeRecebidaAnterior = Number(item.quantidadeRecebida || 0);
      const delta = Number((quantidadeRecebidaNova - quantidadeRecebidaAnterior).toFixed(2));

      if (delta < 0) {
        await transaction.rollback();
        return res.status(400).json({
          error: `Não é possível reduzir a quantidade já recebida de "${item.nomeItem}"`,
        });
      }

      if (delta > 0) {
        if (item.produtoId) {
          const [estoque] = await EstoqueLoja.findOrCreate({
            where: { lojaId: estoqueCentral.id, produtoId: item.produtoId },
            defaults: { quantidade: 0 },
            transaction,
          });

          await estoque.update(
            { quantidade: Number(estoque.quantidade || 0) + delta },
            { transaction },
          );

          const produto = await Produto.findByPk(item.produtoId, { transaction });
          if (produto && item.valorUnitario !== null && item.valorUnitario !== undefined) {
            await produto.update({ custoUnitario: item.valorUnitario }, { transaction });
          }
        } else if (item.insumoId) {
          const insumo = await Insumo.findByPk(item.insumoId, { transaction });
          if (insumo) {
            await insumo.update(
              {
                quantidadeEstoque: Number(insumo.quantidadeEstoque || 0) + delta,
                custoUnitarioUltimo: item.valorUnitario ?? insumo.custoUnitarioUltimo,
              },
              { transaction },
            );
          }
        } else if (item.pecaId) {
          const peca = await Peca.findByPk(item.pecaId, { transaction });
          if (peca) {
            await peca.update(
              {
                quantidadeEstoque: Number(peca.quantidadeEstoque || 0) + delta,
                custoUnitario: item.valorUnitario ?? peca.custoUnitario,
              },
              { transaction },
            );
          }
        }
      }

      await item.update({ quantidadeRecebida: quantidadeRecebidaNova }, { transaction });
      itensAtualizados.push({ ...item.toJSON(), quantidadeRecebida: quantidadeRecebidaNova });
    }

    const possuiPendencia = itensAtualizados.some(
      (item) => Number(item.quantidadeRecebida || 0) < Number(item.quantidade),
    );

    await compra.update(
      {
        status: "RECEBIDO",
        possuiPendencia,
        recebidoPorId: compra.recebidoPorId || req.usuario.id,
        recebidoEm: compra.recebidoEm || new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    const compraAtualizada = await Compra.findByPk(compra.id, { include: includeCompra });

    res.json(comAgregados(compraAtualizada));
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao conferir recebimento da compra:", error);
    res.status(500).json({ error: "Erro ao conferir recebimento da compra" });
  }
};

export const deletarCompra = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);

    if (!compra) {
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    if (!["PESQUISANDO"].includes(compra.status)) {
      return res.status(400).json({
        error: "Só é possível excluir compras que ainda não foram compradas",
      });
    }

    const contasVinculadas = await ContaPagar.count({ where: { compraId: compra.id } });
    if (contasVinculadas > 0) {
      return res.status(400).json({
        error: "Não é possível excluir um pedido que já tem contas a pagar geradas",
      });
    }

    await compra.destroy();
    res.locals.entityId = req.params.id;
    res.json({ message: "Compra excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir compra:", error);
    res.status(500).json({ error: "Erro ao excluir compra" });
  }
};

export const historicoPrecos = async (req, res) => {
  try {
    const { produtoId, insumoId, pecaId, nomeItem } = req.query;

    if (!produtoId && !insumoId && !pecaId && !nomeItem) {
      return res.status(400).json({
        error: "Informe produtoId, insumoId, pecaId ou nomeItem para buscar o histórico",
      });
    }

    const where = { valorUnitario: { [Op.ne]: null } };

    if (produtoId) {
      where.produtoId = produtoId;
    } else if (insumoId) {
      where.insumoId = insumoId;
    } else if (pecaId) {
      where.pecaId = pecaId;
    } else {
      where.nomeItem = { [Op.iLike]: `%${nomeItem.trim()}%` };
    }

    const itens = await CompraItem.findAll({
      where,
      include: [
        {
          model: Compra,
          as: "compra",
          where: { status: { [Op.in]: ["COMPRADO", "RECEBIDO"] } },
          attributes: ["id", "status", "dataCompra"],
          include: [{ model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] }],
        },
      ],
      attributes: ["id", "nomeItem", "valorUnitario", "quantidade", "unidade"],
      order: [[{ model: Compra, as: "compra" }, "dataCompra", "DESC"]],
    });

    res.json(itens);
  } catch (error) {
    console.error("Erro ao buscar histórico de preços:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de preços" });
  }
};
