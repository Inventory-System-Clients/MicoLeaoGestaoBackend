import { sequelize } from "../database/connection.js";
import { randomUUID } from "crypto";
import { Op } from "sequelize";
import {
  EstoqueLoja,
  Envio,
  ItemLacre,
  Lacre,
  Loja,
  Produto,
  Usuario,
} from "../models/index.js";
import { obterOuCriarEstoqueCentral } from "./movimentacaoEstoqueLojaController.js";

const PREFIXO_LACRE_TEMPORARIO = "PENDENTE-";
const gerarNumeroLacreTemporario = () =>
  `${PREFIXO_LACRE_TEMPORARIO}${randomUUID()}`;
const lacreTemNumeroTemporario = (numero) =>
  String(numero || "").startsWith(PREFIXO_LACRE_TEMPORARIO);

const includeEnvio = [
  { model: Loja, as: "lojaDestino", attributes: ["id", "nome"] },
  { model: Usuario, as: "separadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "transportador", attributes: ["id", "nome"] },
  { model: Usuario, as: "despachadoPor", attributes: ["id", "nome"] },
  {
    model: Lacre,
    as: "lacres",
    include: [
      {
        model: ItemLacre,
        as: "itens",
        include: [
          {
            model: Produto,
            as: "produto",
            attributes: ["id", "nome", "codigo"],
          },
        ],
      },
      { model: Usuario, as: "conferidoPor", attributes: ["id", "nome"] },
    ],
  },
];

export const listarEnvios = async (req, res) => {
  try {
    const { lojaDestinoId, dataInicio, dataFim } = req.query;
    const where = {};

    if (req.usuario.role === "ENTREGADOR") {
      where.transportadorId = req.usuario.id;
    }

    if (lojaDestinoId) {
      where.lojaDestinoId = lojaDestinoId;
    }

    if (dataInicio || dataFim) {
      where.createdAt = {};
      if (dataInicio) {
        where.createdAt[Op.gte] = new Date(dataInicio);
      }
      if (dataFim) {
        where.createdAt[Op.lte] = new Date(dataFim);
      }
    }

    const envios = await Envio.findAll({
      where,
      include: includeEnvio,
      order: [["createdAt", "DESC"]],
    });

    res.json(envios);
  } catch (error) {
    console.error("Erro ao listar envios:", error);
    res.status(500).json({ error: "Erro ao listar envios" });
  }
};

export const criarEnvio = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { lojaDestinoId, transportadorId, observacao, lacres } = req.body;

    if (!lojaDestinoId) {
      await transaction.rollback();
      return res.status(400).json({ error: "Selecione a loja de destino" });
    }

    if (!transportadorId) {
      await transaction.rollback();
      return res.status(400).json({ error: "Selecione o transportador" });
    }

    if (!Array.isArray(lacres) || lacres.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Informe ao menos um lacre" });
    }

    const numeros = lacres.map((lacre) => String(lacre.numero || "").trim());
    const numerosFisicos = numeros.filter(Boolean);
    if (false && numeros.some((numero) => !numero)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Todos os lacres precisam de um número" });
    }
    if (new Set(numerosFisicos).size !== numerosFisicos.length) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Os números de lacre não podem se repetir no envio" });
    }

    for (const lacre of lacres) {
      if (!Array.isArray(lacre.itens) || lacre.itens.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          error: `O lacre ${lacre.numero} precisa de ao menos um item`,
        });
      }
      for (const item of lacre.itens) {
        if (
          !item.produtoId ||
          !Number.isInteger(Number(item.quantidade)) ||
          Number(item.quantidade) <= 0
        ) {
          await transaction.rollback();
          return res.status(400).json({
            error: `Item inválido no lacre ${lacre.numero}`,
          });
        }
      }
    }

    if (numerosFisicos.length > 0) {
      const numeroExistente = await Lacre.findOne({
        where: { numero: numerosFisicos },
        transaction,
      });
      if (numeroExistente) {
        await transaction.rollback();
        return res.status(400).json({
          error: `O lacre ${numeroExistente.numero} já foi usado em outro envio`,
        });
      }
    }

    const estoqueCentral = await obterOuCriarEstoqueCentral(transaction);
    if (String(estoqueCentral.id) === String(lojaDestinoId)) {
      await transaction.rollback();
      return res.status(400).json({
        error: "A loja de destino deve ser diferente do Depósito Principal.",
      });
    }

    const lojaDestino = await Loja.findByPk(lojaDestinoId, { transaction });
    if (!lojaDestino || !lojaDestino.ativo) {
      await transaction.rollback();
      return res.status(404).json({ error: "Loja de destino não encontrada" });
    }

    const transportador = await Usuario.findOne({
      where: { id: transportadorId, ativo: true, role: "ENTREGADOR" },
      transaction,
    });
    if (!transportador) {
      await transaction.rollback();
      return res.status(400).json({
        error:
          "Transportador informado inválido, inativo ou sem perfil de entregador",
      });
    }

    // Aviso (não bloqueante de forma rígida): confere se o saldo central
    // atual já cobre o total pedido. A validação real acontece no despacho.
    const totaisPorProduto = new Map();
    for (const lacre of lacres) {
      for (const item of lacre.itens) {
        totaisPorProduto.set(
          item.produtoId,
          (totaisPorProduto.get(item.produtoId) || 0) + Number(item.quantidade),
        );
      }
    }

    for (const [produtoId, quantidade] of totaisPorProduto.entries()) {
      const estoque = await EstoqueLoja.findOne({
        where: { lojaId: estoqueCentral.id, produtoId },
        transaction,
      });
      const disponivel = Number(estoque?.quantidade || 0);
      if (disponivel < quantidade) {
        const produto = await Produto.findByPk(produtoId, { transaction });
        await transaction.rollback();
        return res.status(400).json({
          error: `Estoque insuficiente no Depósito Principal para ${
            produto?.nome || "o produto"
          }. Disponível: ${disponivel}, solicitado: ${quantidade}.`,
        });
      }
    }

    const envio = await Envio.create(
      {
        lojaDestinoId,
        separadoPorId: req.usuario.id,
        transportadorId,
        observacao: observacao || null,
      },
      { transaction },
    );

    for (const lacre of lacres) {
      const lacreCriado = await Lacre.create(
        {
          envioId: envio.id,
          numero:
            String(lacre.numero || "").trim() || gerarNumeroLacreTemporario(),
        },
        { transaction },
      );

      await ItemLacre.bulkCreate(
        lacre.itens.map((item) => ({
          lacreId: lacreCriado.id,
          produtoId: item.produtoId,
          quantidade: Number(item.quantidade),
        })),
        { transaction },
      );
    }

    await transaction.commit();

    const envioCompleto = await Envio.findByPk(envio.id, {
      include: includeEnvio,
    });

    res.locals.entityId = envio.id;
    res.status(201).json(envioCompleto);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao criar envio:", error);
    res.status(500).json({ error: "Erro ao criar envio" });
  }
};

export const despacharEnvio = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const lacresInformados = Array.isArray(req.body?.lacres)
      ? req.body.lacres
      : [];
    const numerosPorLacreId = new Map(
      lacresInformados.map((lacre) => [
        String(lacre.id),
        String(lacre.numero || "").trim(),
      ]),
    );

    const envio = await Envio.findByPk(req.params.id, {
      include: [
        {
          model: Lacre,
          as: "lacres",
          include: [{ model: ItemLacre, as: "itens" }],
        },
      ],
      transaction,
    });

    if (!envio) {
      await transaction.rollback();
      return res.status(404).json({ error: "Envio não encontrado" });
    }

    if (
      req.usuario.role === "ENTREGADOR" &&
      String(envio.transportadorId) !== String(req.usuario.id)
    ) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ error: "Você só pode retirar envios atribuídos a você" });
    }

    if (envio.despachadoEm) {
      await transaction.rollback();
      return res.status(400).json({ error: "Este envio já foi despachado" });
    }

    const numerosFinais = [];
    for (const lacre of envio.lacres) {
      const numeroInformado = numerosPorLacreId.get(String(lacre.id));
      const numeroFinal =
        numeroInformado ||
        (lacreTemNumeroTemporario(lacre.numero)
          ? ""
          : String(lacre.numero || "").trim());

      if (!numeroFinal) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Informe o número físico de todos os lacres antes da retirada",
        });
      }

      numerosFinais.push({ id: lacre.id, numero: numeroFinal });
    }

    const numerosUnicos = new Set(numerosFinais.map((lacre) => lacre.numero));
    if (numerosUnicos.size !== numerosFinais.length) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Os números de lacre não podem se repetir no envio" });
    }

    const numeroExistente = await Lacre.findOne({
      where: {
        numero: [...numerosUnicos],
        id: { [Op.notIn]: numerosFinais.map((lacre) => lacre.id) },
      },
      transaction,
    });
    if (numeroExistente) {
      await transaction.rollback();
      return res.status(400).json({
        error: `O lacre ${numeroExistente.numero} já foi usado em outro envio`,
      });
    }

    for (const lacre of numerosFinais) {
      await Lacre.update(
        { numero: lacre.numero },
        { where: { id: lacre.id }, transaction },
      );
    }

    const totaisPorProduto = new Map();
    for (const lacre of envio.lacres) {
      for (const item of lacre.itens) {
        totaisPorProduto.set(
          item.produtoId,
          (totaisPorProduto.get(item.produtoId) || 0) + Number(item.quantidade),
        );
      }
    }

    const estoqueCentral = await obterOuCriarEstoqueCentral(transaction);

    for (const [produtoId, quantidade] of totaisPorProduto.entries()) {
      const estoque = await EstoqueLoja.findOne({
        where: { lojaId: estoqueCentral.id, produtoId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const disponivel = Number(estoque?.quantidade || 0);
      if (disponivel < quantidade) {
        const produto = await Produto.findByPk(produtoId, { transaction });
        await transaction.rollback();
        return res.status(400).json({
          error: `Estoque insuficiente no Depósito Principal para ${
            produto?.nome || "o produto"
          }. Disponível: ${disponivel}, solicitado: ${quantidade}.`,
        });
      }
    }

    for (const [produtoId, quantidade] of totaisPorProduto.entries()) {
      const estoque = await EstoqueLoja.findOne({
        where: { lojaId: estoqueCentral.id, produtoId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      await estoque.update(
        { quantidade: Number(estoque.quantidade) - quantidade },
        { transaction },
      );
    }

    await Lacre.update(
      { status: "EM_TRANSITO" },
      { where: { envioId: envio.id, status: "SEPARADO" }, transaction },
    );

    await envio.update(
      { despachadoPorId: req.usuario.id, despachadoEm: new Date() },
      { transaction },
    );

    await transaction.commit();

    const envioAtualizado = await Envio.findByPk(envio.id, {
      include: includeEnvio,
    });

    res.json(envioAtualizado);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao despachar envio:", error);
    res.status(500).json({ error: "Erro ao despachar envio" });
  }
};
