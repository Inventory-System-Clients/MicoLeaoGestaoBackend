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

const comAgregados = (compra) => {
  const plain = compra.toJSON ? compra.toJSON() : compra;
  const valorTotalPedido = Number(
    (plain.itens || [])
      .reduce((acc, item) => acc + Number(item.valorTotal || 0), 0)
      .toFixed(2),
  );
  const valorCustosAdicionais = Number(
    (plain.custosAdicionais || [])
      .reduce((acc, custo) => acc + Number(custo.valor || 0), 0)
      .toFixed(2),
  );
  const valorGeralPedido = Number((valorTotalPedido + valorCustosAdicionais).toFixed(2));
  return { ...plain, valorTotalPedido, valorCustosAdicionais, valorGeralPedido };
};

const validarItem = async (item, transaction) => {
  const nomeItem = (item.nomeItem || "").trim();
  if (!nomeItem) {
    throw new ErroValidacaoCompra("Informe o nome de cada item do pedido");
  }

  const produtoId = item.produtoId || null;
  const insumoId = item.insumoId || null;
  const pecaId = item.pecaId || null;

  if ([produtoId, insumoId, pecaId].filter(Boolean).length > 1) {
    throw new ErroValidacaoCompra("Cada item deve ter no máximo um produto, insumo ou peça");
  }

  const quantidadeNumerica = Number(item.quantidade);
  if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
    throw new ErroValidacaoCompra(`Informe uma quantidade válida para "${nomeItem}"`);
  }

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

  return {
    tipoItem: item.tipoItem || (produtoId ? "PRODUTO" : insumoId ? "INSUMO" : pecaId ? "PECA" : "PRODUTO"),
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

  const valor = Number(custo.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new ErroValidacaoCompra(`Informe um valor válido para o custo adicional "${descricao}"`);
  }

  const formaPagamento = custo.formaPagamento;
  if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    throw new ErroValidacaoCompra(`Forma de pagamento inválida para o custo adicional "${descricao}"`);
  }

  return { descricao, valor, formaPagamento };
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
      moeda,
      tipoPagamento,
      quantidadeParcelas,
      formaPagamento,
      fotoUrl,
      observacao,
      itens,
      custosAdicionais,
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

    const compra = await Compra.create(
      {
        fornecedorId: fornecedorId || null,
        moeda: moedaFinal,
        tipoPagamento: tipoPagamento || null,
        quantidadeParcelas: quantidadeParcelasFinal,
        formaPagamento: formaPagamento || null,
        fotoUrl: fotoUrl || null,
        observacao: observacao || null,
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
      moeda,
      tipoPagamento,
      quantidadeParcelas,
      formaPagamento,
      fotoUrl,
      observacao,
      itens,
      custosAdicionais,
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

    if ((itens !== undefined || custosAdicionais !== undefined) && compra.status !== "PESQUISANDO") {
      await transaction.rollback();
      return res.status(400).json({
        error: "Só é possível editar os itens de um pedido enquanto ele está em pesquisa",
      });
    }

    await compra.update(
      {
        fornecedorId: fornecedorId !== undefined ? fornecedorId || null : compra.fornecedorId,
        moeda: moeda !== undefined ? moeda : compra.moeda,
        tipoPagamento: tipoPagamento !== undefined ? tipoPagamento || null : compra.tipoPagamento,
        quantidadeParcelas:
          quantidadeParcelas !== undefined ? Number(quantidadeParcelas) || null : compra.quantidadeParcelas,
        formaPagamento: formaPagamento !== undefined ? formaPagamento || null : compra.formaPagamento,
        fotoUrl: fotoUrl !== undefined ? fotoUrl || null : compra.fotoUrl,
        observacao: observacao !== undefined ? observacao || null : compra.observacao,
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
      COMPRADO: ["RECEBIDO"],
      RECEBIDO: [],
    };

    if (!transicoesPermitidas[statusAtual]?.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Nao e possivel voltar etapa ou pular o fluxo da compra",
      });
    }

    const dadosAtualizacao = { status };

    if (status === "COMPRADO") {
      dadosAtualizacao.dataCompra = compra.dataCompra || new Date();
      dadosAtualizacao.compradorId = compra.compradorId || req.usuario.id;
    }

    if (status === "RECEBIDO") {
      const estoqueCentral = await obterOuCriarEstoqueCentral(transaction);

      for (const item of compra.itens) {
        if (item.produtoId) {
          const [estoque] = await EstoqueLoja.findOrCreate({
            where: { lojaId: estoqueCentral.id, produtoId: item.produtoId },
            defaults: { quantidade: 0 },
            transaction,
          });

          await estoque.update(
            { quantidade: Number(estoque.quantidade || 0) + Number(item.quantidade) },
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
                quantidadeEstoque: Number(insumo.quantidadeEstoque) + Number(item.quantidade),
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
                quantidadeEstoque: Number(peca.quantidadeEstoque || 0) + Number(item.quantidade),
                custoUnitario: item.valorUnitario ?? peca.custoUnitario,
              },
              { transaction },
            );
          }
        }
      }

      dadosAtualizacao.recebidoPorId = req.usuario.id;
      dadosAtualizacao.recebidoEm = new Date();
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
