import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  GastoVariavel,
  MovimentacaoVeiculo,
  Veiculo,
  Usuario,
} from "../models/index.js";

function getCombustivelLabel(valor) {
  switch (String(valor)) {
    case "5":
      return "5 palzinhos";
    case "4":
      return "4 palzinhos";
    case "3":
      return "3 palzinhos";
    case "2":
      return "2 palzinhos";
    case "1":
      return "1 palzinho";
    case "0":
      return "Vazio";
    default:
      return valor;
  }
}

export const criarGastoVariavel = async (req, res) => {
  try {
    const {
      lojaId,
      nome,
      valor,
      observacao,
      veiculoId,
      km,
      estado,
      modo,
      combustivel,
      limpeza,
    } = req.body;
    const usuarioId = req.usuario?.id;

    if (!lojaId || !nome || !usuarioId) {
      return res
        .status(400)
        .json({ error: "Campos obrigatórios não preenchidos." });
    }

    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res
        .status(400)
        .json({ error: "Informe um valor válido para o gasto." });
    }

    const agora = new Date();

    if (veiculoId) {
      const kmNumerico = Number(km);
      const kmInvalido =
        km === undefined ||
        km === null ||
        String(km).trim() === "" ||
        !Number.isFinite(kmNumerico) ||
        kmNumerico < 0;

      if (kmInvalido) {
        return res.status(400).json({
          error: "Informe uma quilometragem válida para o veículo.",
        });
      }

      const transaction = await sequelize.transaction();
      try {
        const veiculo = await Veiculo.findByPk(veiculoId, { transaction });
        if (!veiculo) {
          await transaction.rollback();
          return res.status(404).json({ error: "Veículo não encontrado." });
        }

        const kmAtualVeiculo = Number(veiculo.km || 0);
        if (kmNumerico < kmAtualVeiculo) {
          await transaction.rollback();
          return res.status(400).json({
            error: `A quilometragem informada (${kmNumerico}) não pode ser menor que a quilometragem atual do veículo (${kmAtualVeiculo}).`,
          });
        }

        const combustivelLabel = combustivel
          ? getCombustivelLabel(combustivel)
          : veiculo.nivelCombustivel;
        const modoFinal = modo || veiculo.modo;
        const estadoFinal = estado || veiculo.estado;
        const limpezaFinal = limpeza || veiculo.nivelLimpeza;

        await veiculo.update(
          {
            km: kmNumerico,
            estado: estadoFinal,
            modo: modoFinal,
            nivelCombustivel: combustivelLabel,
            nivelLimpeza: limpezaFinal,
          },
          { transaction },
        );

        const obsGasto = `Abastecimento: R$ ${valorNumerico.toFixed(2)}${
          observacao ? ` - ${observacao}` : ""
        }`;

        await MovimentacaoVeiculo.create(
          {
            veiculoId,
            usuarioId,
            tipo: "abastecimento",
            dataHora: agora,
            gasolina: combustivelLabel,
            nivel_limpeza: limpezaFinal,
            estado: estadoFinal,
            modo: modoFinal,
            obs: obsGasto,
            km: kmNumerico,
          },
          { transaction },
        );

        const gasto = await GastoVariavel.create(
          {
            lojaId,
            nome,
            valor: valorNumerico,
            observacao: observacao || null,
            dataInicio: agora,
            dataFim: agora,
            usuarioId,
            veiculoId,
          },
          { transaction },
        );

        await transaction.commit();
        return res.status(201).json(gasto);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    const gasto = await GastoVariavel.create({
      lojaId,
      nome,
      valor: valorNumerico,
      observacao: observacao || null,
      dataInicio: agora,
      dataFim: agora,
      usuarioId,
      veiculoId: null,
    });

    res.status(201).json(gasto);
  } catch (error) {
    console.error("Erro ao criar gasto variável:", error);
    res.status(500).json({ error: "Erro ao criar gasto variável." });
  }
};

export const atualizarGastoVariavel = async (req, res) => {
  try {
    const { id } = req.params;
    const { lojaId, nome, valor, observacao, data } = req.body;

    const gasto = await GastoVariavel.findByPk(id);
    if (!gasto) {
      return res.status(404).json({ error: "Gasto variável não encontrado." });
    }

    if (!lojaId || !nome) {
      return res
        .status(400)
        .json({ error: "Campos obrigatórios não preenchidos." });
    }

    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return res
        .status(400)
        .json({ error: "Informe um valor válido para o gasto." });
    }

    const dataGasto = data ? new Date(`${data}T12:00:00`) : gasto.dataInicio;

    await gasto.update({
      lojaId,
      nome,
      valor: valorNumerico,
      observacao: observacao || null,
      dataInicio: dataGasto,
      dataFim: dataGasto,
    });

    res.json(gasto);
  } catch (error) {
    console.error("Erro ao atualizar gasto variável:", error);
    res.status(500).json({ error: "Erro ao atualizar gasto variável." });
  }
};

export const excluirGastoVariavel = async (req, res) => {
  try {
    const { id } = req.params;
    const gasto = await GastoVariavel.findByPk(id);
    if (!gasto) {
      return res.status(404).json({ error: "Gasto variável não encontrado." });
    }

    await gasto.destroy();
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir gasto variável:", error);
    res.status(500).json({ error: "Erro ao excluir gasto variável." });
  }
};

export const listarGastosVariaveis = async (req, res) => {
  try {
    const { lojaId, dataInicio, dataFim, nome, veiculoId } = req.query;
    const where = {};
    if (lojaId) where.lojaId = lojaId;
    if (nome) where.nome = nome;
    if (veiculoId) where.veiculoId = veiculoId;
    if (dataInicio) {
      where.dataInicio = { [Op.gte]: new Date(`${dataInicio}T00:00:00`) };
    }
    if (dataFim) {
      where.dataFim = { [Op.lte]: new Date(`${dataFim}T23:59:59`) };
    }

    const gastos = await GastoVariavel.findAll({
      where,
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
        {
          model: Veiculo,
          as: "veiculo",
          attributes: ["id", "nome", "modelo"],
        },
      ],
      order: [["dataInicio", "DESC"]],
    });
    res.json(gastos);
  } catch (error) {
    console.error("Erro ao listar gastos variáveis:", error);
    res.status(500).json({ error: "Erro ao listar gastos variáveis." });
  }
};
