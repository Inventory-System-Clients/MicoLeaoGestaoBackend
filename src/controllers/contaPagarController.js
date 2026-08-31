import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import { Compra, ContaPagar, Fornecedor, Usuario } from "../models/index.js";

const STATUS_VALIDOS = ["PENDENTE", "PAGA"];
const MOEDAS_VALIDAS = ["BRL", "USD"];
const FORMAS_PAGAMENTO_VALIDAS = ["PIX", "DINHEIRO", "BOLETO"];

const includeConta = [
  { model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] },
  { model: Compra, as: "compra", attributes: ["id", "moeda", "numeroPedido"] },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "pagoPor", attributes: ["id", "nome"] },
];

const calcularValorBrl = (valor, moeda, cotacaoDolar) =>
  moeda === "USD" && cotacaoDolar
    ? Number((Number(valor) * Number(cotacaoDolar)).toFixed(2))
    : null;

export const listarContasPagar = async (req, res) => {
  try {
    const { status, fornecedorId, origem, vencimentoInicio, vencimentoFim } = req.query;
    const where = {};

    if (status) {
      const statusLista = status.split(",").filter((s) => STATUS_VALIDOS.includes(s));
      if (statusLista.length > 0) where.status = { [Op.in]: statusLista };
    }
    if (fornecedorId) where.fornecedorId = fornecedorId;
    if (origem && ["COMPRA", "AVULSO"].includes(origem)) where.origem = origem;

    if (vencimentoInicio || vencimentoFim) {
      where.vencimento = {};
      if (vencimentoInicio) where.vencimento[Op.gte] = vencimentoInicio;
      if (vencimentoFim) where.vencimento[Op.lte] = vencimentoFim;
    }

    const contas = await ContaPagar.findAll({
      where,
      include: includeConta,
      order: [["vencimento", "ASC"]],
    });

    res.json(contas);
  } catch (error) {
    console.error("Erro ao listar contas a pagar:", error);
    res.status(500).json({ error: "Erro ao listar contas a pagar" });
  }
};

export const criarContaAvulsa = async (req, res) => {
  try {
    const { descricao, fornecedorId, valor, moeda, cotacaoDolar, vencimento, formaPagamento, observacao } =
      req.body;

    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ error: "Informe a descrição da conta" });
    }

    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({ error: "Informe um valor válido" });
    }

    const moedaFinal = moeda || "BRL";
    if (!MOEDAS_VALIDAS.includes(moedaFinal)) {
      return res.status(400).json({ error: "Moeda inválida" });
    }

    if (!vencimento) {
      return res.status(400).json({ error: "Informe o vencimento" });
    }

    if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
      return res.status(400).json({ error: "Forma de pagamento inválida" });
    }

    const conta = await ContaPagar.create({
      origem: "AVULSO",
      compraId: null,
      fornecedorId: fornecedorId || null,
      descricao: descricao.trim(),
      numeroParcela: null,
      totalParcelas: null,
      valor: valorNumerico,
      moeda: moedaFinal,
      cotacaoDolar: cotacaoDolar || null,
      valorBrl: calcularValorBrl(valorNumerico, moedaFinal, cotacaoDolar),
      vencimento,
      formaPagamento,
      status: "PENDENTE",
      criadoPorId: req.usuario.id,
      observacao: observacao || null,
    });

    const contaCompleta = await ContaPagar.findByPk(conta.id, { include: includeConta });

    res.locals.entityId = conta.id;
    res.status(201).json(contaCompleta);
  } catch (error) {
    console.error("Erro ao criar conta a pagar:", error);
    res.status(500).json({ error: "Erro ao criar conta a pagar" });
  }
};

export const gerarParcelasDeCompra = async (req, res) => {
  if (req.usuario?.role === "FUNCIONARIO_ESTOQUE") {
    return res.status(403).json({
      error: "Estoque não pode gerar contas a pagar (custo).",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const compra = await Compra.findByPk(req.params.id, { transaction });

    if (!compra) {
      await transaction.rollback();
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    const jaGeradas = await ContaPagar.count({ where: { compraId: compra.id }, transaction });
    if (jaGeradas > 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Contas a pagar já foram geradas para este pedido",
      });
    }

    const { parcelas } = req.body;
    if (!Array.isArray(parcelas) || parcelas.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Informe ao menos uma parcela" });
    }

    const quantidadeEsperada = compra.tipoPagamento === "PARCELADO" ? compra.quantidadeParcelas || 1 : 1;
    if (parcelas.length !== quantidadeEsperada) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Este pedido precisa de exatamente ${quantidadeEsperada} parcela(s)`,
      });
    }

    const parcelasValidadas = parcelas.map((parcela, index) => {
      const valorNumerico = Number(parcela.valor);
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        throw new Error(`Informe um valor válido para a parcela ${index + 1}`);
      }
      if (!parcela.vencimento) {
        throw new Error(`Informe o vencimento da parcela ${index + 1}`);
      }
      const formaPagamento = parcela.formaPagamento || compra.formaPagamento;
      if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
        throw new Error(`Forma de pagamento inválida na parcela ${index + 1}`);
      }
      return {
        numeroParcela: parcela.numeroParcela || index + 1,
        vencimento: parcela.vencimento,
        valor: valorNumerico,
        cotacaoDolar: parcela.cotacaoDolar || null,
        formaPagamento,
      };
    });

    const contasCriadas = await ContaPagar.bulkCreate(
      parcelasValidadas.map((parcela) => ({
        origem: "COMPRA",
        compraId: compra.id,
        fornecedorId: compra.fornecedorId,
        descricao: `${compra.numeroPedido ? `Pedido #${compra.numeroPedido} — ` : ""}Parcela ${parcela.numeroParcela}/${parcelasValidadas.length}`,
        numeroParcela: parcela.numeroParcela,
        totalParcelas: parcelasValidadas.length,
        valor: parcela.valor,
        moeda: compra.moeda,
        cotacaoDolar: parcela.cotacaoDolar,
        valorBrl: calcularValorBrl(parcela.valor, compra.moeda, parcela.cotacaoDolar),
        vencimento: parcela.vencimento,
        formaPagamento: parcela.formaPagamento,
        status: "PENDENTE",
        criadoPorId: req.usuario.id,
      })),
      { transaction },
    );

    await transaction.commit();

    const contasCompletas = await ContaPagar.findAll({
      where: { id: contasCriadas.map((conta) => conta.id) },
      include: includeConta,
      order: [["numeroParcela", "ASC"]],
    });

    res.status(201).json(contasCompletas);
  } catch (error) {
    await transaction.rollback();
    if (error.message && error.message.startsWith("Informe")) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message && error.message.includes("inválida na parcela")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao gerar contas a pagar:", error);
    res.status(500).json({ error: "Erro ao gerar contas a pagar" });
  }
};

export const atualizarConta = async (req, res) => {
  try {
    const conta = await ContaPagar.findByPk(req.params.id);

    if (!conta) {
      return res.status(404).json({ error: "Conta a pagar não encontrada" });
    }

    if (conta.status !== "PENDENTE") {
      return res.status(400).json({ error: "Não é possível editar uma conta já paga" });
    }

    const { descricao, fornecedorId, valor, moeda, cotacaoDolar, vencimento, formaPagamento, observacao } =
      req.body;

    const valorFinal = valor !== undefined ? Number(valor) : Number(conta.valor);
    if (!Number.isFinite(valorFinal) || valorFinal <= 0) {
      return res.status(400).json({ error: "Informe um valor válido" });
    }

    const moedaFinal = moeda !== undefined ? moeda : conta.moeda;
    if (!MOEDAS_VALIDAS.includes(moedaFinal)) {
      return res.status(400).json({ error: "Moeda inválida" });
    }

    const formaPagamentoFinal = formaPagamento !== undefined ? formaPagamento : conta.formaPagamento;
    if (!FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamentoFinal)) {
      return res.status(400).json({ error: "Forma de pagamento inválida" });
    }

    const cotacaoFinal = cotacaoDolar !== undefined ? cotacaoDolar : conta.cotacaoDolar;

    await conta.update({
      descricao: descricao !== undefined ? descricao : conta.descricao,
      fornecedorId: fornecedorId !== undefined ? fornecedorId || null : conta.fornecedorId,
      valor: valorFinal,
      moeda: moedaFinal,
      cotacaoDolar: cotacaoFinal || null,
      valorBrl: calcularValorBrl(valorFinal, moedaFinal, cotacaoFinal),
      vencimento: vencimento !== undefined ? vencimento : conta.vencimento,
      formaPagamento: formaPagamentoFinal,
      observacao: observacao !== undefined ? observacao || null : conta.observacao,
    });

    const contaAtualizada = await ContaPagar.findByPk(conta.id, { include: includeConta });

    res.json(contaAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar conta a pagar:", error);
    res.status(500).json({ error: "Erro ao atualizar conta a pagar" });
  }
};

export const marcarComoPaga = async (req, res) => {
  try {
    const conta = await ContaPagar.findByPk(req.params.id);

    if (!conta) {
      return res.status(404).json({ error: "Conta a pagar não encontrada" });
    }

    if (conta.status !== "PENDENTE") {
      return res.status(400).json({ error: "Esta conta já está paga" });
    }

    await conta.update({
      status: "PAGA",
      pagoPorId: req.usuario.id,
      pagoEm: req.body.pagoEm || new Date(),
    });

    const contaAtualizada = await ContaPagar.findByPk(conta.id, { include: includeConta });

    res.json(contaAtualizada);
  } catch (error) {
    console.error("Erro ao marcar conta como paga:", error);
    res.status(500).json({ error: "Erro ao marcar conta como paga" });
  }
};

export const excluirConta = async (req, res) => {
  try {
    const conta = await ContaPagar.findByPk(req.params.id);

    if (!conta) {
      return res.status(404).json({ error: "Conta a pagar não encontrada" });
    }

    if (conta.status !== "PENDENTE") {
      return res.status(400).json({ error: "Só é possível excluir contas ainda não pagas" });
    }

    await conta.destroy();
    res.locals.entityId = req.params.id;
    res.json({ message: "Conta a pagar excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir conta a pagar:", error);
    res.status(500).json({ error: "Erro ao excluir conta a pagar" });
  }
};
