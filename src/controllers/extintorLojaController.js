import { ExtintorLoja } from "../models/index.js";
import { sequelize } from "../database/connection.js";
import { Op } from "sequelize";

export const getExtintores = async (req, res) => {
  try {
    const { lojaId } = req.params;
    const extintores = await ExtintorLoja.findAll({
      where: { lojaId },
      order: [["dataVencimento", "ASC"]],
    });
    res.json(extintores);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Erro ao buscar extintores", details: err.message });
  }
};

// Substitui a lista inteira de extintores de uma loja pelo array recebido
// (mesmo padrão usado pelos Gastos Fixos): cria/atualiza os enviados e
// remove do banco quem não veio na lista.
export const saveExtintores = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { lojaId } = req.params;
    const { extintores } = req.body;

    if (!Array.isArray(extintores)) {
      await transaction.rollback();
      return res.status(400).json({ error: "Extintores inválidos" });
    }

    const idsRecebidos = [];

    for (const extintor of extintores) {
      if (!extintor.dataVencimento) continue;

      if (extintor.id) {
        const [linhasAfetadas] = await ExtintorLoja.update(
          {
            identificacao: extintor.identificacao || null,
            numero: extintor.numero || null,
            dataVencimento: extintor.dataVencimento,
          },
          { where: { id: extintor.id, lojaId }, transaction },
        );

        if (linhasAfetadas > 0) {
          idsRecebidos.push(extintor.id);
        }
      } else {
        const criado = await ExtintorLoja.create(
          {
            lojaId,
            identificacao: extintor.identificacao || null,
            numero: extintor.numero || null,
            dataVencimento: extintor.dataVencimento,
          },
          { transaction },
        );
        idsRecebidos.push(criado.id);
      }
    }

    await ExtintorLoja.destroy({
      where: {
        lojaId,
        id: { [Op.notIn]: idsRecebidos.length > 0 ? idsRecebidos : [0] },
      },
      transaction,
    });

    await transaction.commit();

    const extintoresAtuais = await ExtintorLoja.findAll({
      where: { lojaId },
      order: [["dataVencimento", "ASC"]],
    });
    res.json(extintoresAtuais);
  } catch (err) {
    await transaction.rollback();
    res
      .status(500)
      .json({ error: "Erro ao salvar extintores", details: err.message });
  }
};

export default {
  getExtintores,
  saveExtintores,
};
