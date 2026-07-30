import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  Compra,
  EstoqueLoja,
  Fornecedor,
  Insumo,
  Loja,
  Produto,
  Usuario,
} from "../models/index.js";
import { obterOuCriarEstoqueCentral } from "./movimentacaoEstoqueLojaController.js";

const STATUS_VALIDOS = ["PESQUISANDO", "APROVADO", "COMPRADO", "RECEBIDO"];

const includeCompra = [
  { model: Produto, as: "produto", attributes: ["id", "codigo", "nome"] },
  { model: Insumo, as: "insumo", attributes: ["id", "nome", "unidade"] },
  { model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] },
  { model: Loja, as: "loja", attributes: ["id", "nome"] },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "comprador", attributes: ["id", "nome"] },
  { model: Usuario, as: "recebidoPor", attributes: ["id", "nome"] },
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
    if (lojaId) where.lojaId = lojaId;

    if (produto && produto.trim()) {
      const termo = `%${produto.trim()}%`;
      where[Op.or] = [
        { nomeItem: { [Op.iLike]: termo } },
        { "$produto.nome$": { [Op.iLike]: termo } },
        { "$insumo.nome$": { [Op.iLike]: termo } },
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

    const valorMinNumero = Number(valorMin);
    const valorMaxNumero = Number(valorMax);
    const temValorMin =
      valorMin !== undefined && valorMin !== "" && Number.isFinite(valorMinNumero);
    const temValorMax =
      valorMax !== undefined && valorMax !== "" && Number.isFinite(valorMaxNumero);

    if (temValorMin || temValorMax) {
      where.valorTotal = {};
      if (temValorMin) {
        where.valorTotal[Op.gte] = valorMinNumero;
      }
      if (temValorMax) {
        where.valorTotal[Op.lte] = valorMaxNumero;
      }
    }

    const compras = await Compra.findAll({
      where,
      include: includeCompra,
      subQuery: false,
      order: [["createdAt", "DESC"]],
    });

    res.json(compras);
  } catch (error) {
    console.error("Erro ao listar compras:", error);
    res.status(500).json({ error: "Erro ao listar compras" });
  }
};

export const criarCompra = async (req, res) => {
  try {
    const {
      nomeItem,
      produtoId,
      insumoId,
      fornecedorId,
      lojaId,
      descricaoUso,
      quantidade,
      unidade,
      valorUnitario,
      valorTotal,
      fotoUrl,
      observacao,
    } = req.body;

    if (!nomeItem || !nomeItem.trim()) {
      return res.status(400).json({ error: "Informe o nome do item" });
    }

    if (produtoId && insumoId) {
      return res.status(400).json({
        error: "Selecione ou um produto ou um insumo, não os dois",
      });
    }

    const quantidadeNumerica = Number(quantidade);
    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      return res
        .status(400)
        .json({ error: "Informe uma quantidade válida (maior que zero)" });
    }

    if (produtoId) {
      const produto = await Produto.findByPk(produtoId);
      if (!produto) {
        return res.status(400).json({ error: "Produto informado não encontrado" });
      }
    }

    if (insumoId) {
      const insumo = await Insumo.findByPk(insumoId);
      if (!insumo) {
        return res.status(400).json({ error: "Insumo informado não encontrado" });
      }
    }

    const compra = await Compra.create({
      nomeItem: nomeItem.trim(),
      produtoId: produtoId || null,
      insumoId: insumoId || null,
      fornecedorId: fornecedorId || null,
      lojaId: lojaId || null,
      descricaoUso: descricaoUso || null,
      quantidade: quantidadeNumerica,
      unidade: unidade || null,
      valorUnitario: valorUnitario || null,
      valorTotal: calcularValorTotal(quantidadeNumerica, valorUnitario, valorTotal),
      fotoUrl: fotoUrl || null,
      observacao: observacao || null,
      criadoPorId: req.usuario.id,
    });

    const compraCompleta = await Compra.findByPk(compra.id, {
      include: includeCompra,
    });

    res.locals.entityId = compra.id;
    res.status(201).json(compraCompleta);
  } catch (error) {
    console.error("Erro ao criar compra:", error);
    res.status(500).json({ error: "Erro ao criar compra" });
  }
};

export const atualizarCompra = async (req, res) => {
  try {
    const compra = await Compra.findByPk(req.params.id);

    if (!compra) {
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    const {
      nomeItem,
      produtoId,
      insumoId,
      fornecedorId,
      lojaId,
      descricaoUso,
      quantidade,
      unidade,
      valorUnitario,
      valorTotal,
      fotoUrl,
      observacao,
    } = req.body;

    if (
      (produtoId ?? compra.produtoId) &&
      (insumoId ?? compra.insumoId)
    ) {
      return res.status(400).json({
        error: "Selecione ou um produto ou um insumo, não os dois",
      });
    }

    const quantidadeFinal =
      quantidade !== undefined ? Number(quantidade) : Number(compra.quantidade);
    const valorUnitarioFinal =
      valorUnitario !== undefined ? valorUnitario : compra.valorUnitario;

    await compra.update({
      nomeItem: nomeItem !== undefined ? nomeItem.trim() : compra.nomeItem,
      produtoId: produtoId !== undefined ? produtoId || null : compra.produtoId,
      insumoId: insumoId !== undefined ? insumoId || null : compra.insumoId,
      fornecedorId:
        fornecedorId !== undefined ? fornecedorId || null : compra.fornecedorId,
      lojaId: lojaId !== undefined ? lojaId || null : compra.lojaId,
      descricaoUso:
        descricaoUso !== undefined ? descricaoUso || null : compra.descricaoUso,
      quantidade: quantidadeFinal,
      unidade: unidade !== undefined ? unidade || null : compra.unidade,
      valorUnitario: valorUnitarioFinal,
      valorTotal: calcularValorTotal(quantidadeFinal, valorUnitarioFinal, valorTotal),
      fotoUrl: fotoUrl !== undefined ? fotoUrl || null : compra.fotoUrl,
      observacao: observacao !== undefined ? observacao || null : compra.observacao,
    });

    const compraAtualizada = await Compra.findByPk(compra.id, {
      include: includeCompra,
    });

    res.json(compraAtualizada);
  } catch (error) {
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

    const compra = await Compra.findByPk(req.params.id, { transaction });

    if (!compra) {
      await transaction.rollback();
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    if (compra.status === status) {
      await transaction.rollback();
      return res.status(400).json({ error: "A compra já está com este status" });
    }

    const dadosAtualizacao = { status };

    if (status === "COMPRADO") {
      dadosAtualizacao.dataCompra = compra.dataCompra || new Date();
      dadosAtualizacao.compradorId = compra.compradorId || req.usuario.id;
    }

    if (status === "RECEBIDO") {
      if (compra.produtoId) {
        // O produto sempre chega primeiro no Depósito Principal, igual uma
        // compra de fornecedor comum. Se a compra tem uma loja de destino
        // (campo "onde será usado"), a ida até a loja precisa passar pelo
        // envio com lacre, não pode creditar o estoque da loja direto aqui.
        const estoqueCentral = await obterOuCriarEstoqueCentral(transaction);

        const [estoque] = await EstoqueLoja.findOrCreate({
          where: { lojaId: estoqueCentral.id, produtoId: compra.produtoId },
          defaults: { quantidade: 0 },
          transaction,
        });

        await estoque.update(
          { quantidade: Number(estoque.quantidade || 0) + Number(compra.quantidade) },
          { transaction },
        );
      } else if (compra.insumoId) {
        const insumo = await Insumo.findByPk(compra.insumoId, { transaction });
        if (insumo) {
          await insumo.update(
            {
              quantidadeEstoque:
                Number(insumo.quantidadeEstoque) + Number(compra.quantidade),
              custoUnitarioUltimo:
                compra.valorUnitario ?? insumo.custoUnitarioUltimo,
            },
            { transaction },
          );
        }
      }

      dadosAtualizacao.recebidoPorId = req.usuario.id;
      dadosAtualizacao.recebidoEm = new Date();
    }

    await compra.update(dadosAtualizacao, { transaction });

    await transaction.commit();

    const compraAtualizada = await Compra.findByPk(compra.id, {
      include: includeCompra,
    });

    res.json(compraAtualizada);
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

    if (!["PESQUISANDO", "APROVADO"].includes(compra.status)) {
      return res.status(400).json({
        error: "Só é possível excluir compras que ainda não foram compradas",
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
    const { produtoId, insumoId, nomeItem } = req.query;

    if (!produtoId && !insumoId && !nomeItem) {
      return res.status(400).json({
        error: "Informe produtoId, insumoId ou nomeItem para buscar o histórico",
      });
    }

    const where = {
      status: { [Op.in]: ["COMPRADO", "RECEBIDO"] },
      valorUnitario: { [Op.ne]: null },
    };

    if (produtoId) {
      where.produtoId = produtoId;
    } else if (insumoId) {
      where.insumoId = insumoId;
    } else {
      where.nomeItem = { [Op.iLike]: `%${nomeItem.trim()}%` };
    }

    const compras = await Compra.findAll({
      where,
      include: [
        { model: Fornecedor, as: "fornecedor", attributes: ["id", "nome"] },
      ],
      attributes: [
        "id",
        "nomeItem",
        "valorUnitario",
        "quantidade",
        "unidade",
        "dataCompra",
        "fornecedorId",
      ],
      order: [["dataCompra", "DESC"]],
    });

    res.json(compras);
  } catch (error) {
    console.error("Erro ao buscar histórico de preços:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de preços" });
  }
};
