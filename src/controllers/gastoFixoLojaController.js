import { GastoFixoLoja, GastoTotalFixoLoja } from "../models/index.js";
import { sequelize } from "../database/connection.js";
import { Op } from "sequelize";
import { calcularTotalFixoAtualDaLoja } from "../services/gastoFixoService.js";

const normalizarNomeGasto = (nomeOriginal) =>
  String(nomeOriginal || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizarNomeParaPersistencia = (nomeOriginal) => {
  const nome = String(nomeOriginal || "").trim();
  const chave = normalizarNomeGasto(nome);

  if (
    chave === "alugel dobrado ultimo mes (12x)" ||
    chave === "aluguel dobrado ultimo mes (12x)" ||
    chave === "alugel dobrado ultimo mes" ||
    chave === "aluguel dobrado ultimo mes"
  ) {
    return "Aluguel dobrado último mês";
  }

  return nome;
};

export const getGastosFixos = async (req, res) => {
  try {
    const { lojaId } = req.params;
    const gastos = await GastoFixoLoja.findAll({
      where: { lojaId },
      order: [["nome", "ASC"]],
    });
    res.json(gastos);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao buscar gastos fixos", details: err.message });
  }
};

export const saveGastosFixos = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { lojaId } = req.params;
    const { gastos } = req.body;

    if (!Array.isArray(gastos)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Gastos inválidos" });
    }

    const nomesRecebidos = [];

    for (const gasto of gastos) {
      const nome = normalizarNomeParaPersistencia(gasto.nome);
      if (!nome) continue;

      nomesRecebidos.push(nome);

      await GastoFixoLoja.upsert(
        {
          lojaId,
          nome,
          valor: Number(gasto.valor || 0),
          observacao: gasto.observacao || null,
          vigenciaInicio: gasto.vigenciaInicio || null,
          vigenciaFim: gasto.vigenciaFim || null,
        },
        { transaction },
      );
    }

    if (nomesRecebidos.length > 0) {
      await GastoFixoLoja.destroy({
        where: {
          lojaId,
          nome: { [Op.notIn]: nomesRecebidos },
        },
        transaction,
      });
    }

    const gastosAtuais = await GastoFixoLoja.findAll({
      where: { lojaId },
      attributes: ["id", "nome"],
      order: [["id", "DESC"]],
      raw: true,
      transaction,
    });

    const nomesJaVistos = new Set();
    const idsParaRemover = [];

    for (const item of gastosAtuais) {
      const chave = normalizarNomeGasto(item.nome);
      if (!chave) {
        idsParaRemover.push(item.id);
        continue;
      }

      if (nomesJaVistos.has(chave)) {
        idsParaRemover.push(item.id);
        continue;
      }

      nomesJaVistos.add(chave);
    }

    if (idsParaRemover.length > 0) {
      await GastoFixoLoja.destroy({
        where: { id: { [Op.in]: idsParaRemover } },
        transaction,
      });
    }

    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const valorTotal = await calcularTotalFixoAtualDaLoja(lojaId, transaction);

    await GastoTotalFixoLoja.upsert(
      {
        lojaId,
        ano,
        mes,
        valorTotal,
      },
      { transaction },
    );

    await transaction.commit();
    res.json({ success: true, ano, mes, valorTotal });
  } catch (err) {
    await transaction.rollback();
    res
      .status(500)
      .json({ error: "Erro ao salvar gastos fixos", details: err.message });
  }
};

export default {
  getGastosFixos,
  saveGastosFixos,
};
