import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  GastoVariavel,
  Loja,
  Maquina,
  Manutencao,
  ManutencaoUsuario,
  Usuario,
} from "../models/index.js";
import { normalizarStatusOperacao } from "./maquinaController.js";

const STATUS_ABERTOS = ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_PECA"];
const STATUS_VALIDOS = [...STATUS_ABERTOS, "CONCLUIDA"];
const DIAS_RECORRENCIA = 30;
const MINIMO_RECENTES_RECORRENCIA = 3;
const MINIMO_MESMO_TIPO_RECORRENCIA = 2;

const includeAdmin = [
  {
    model: Usuario,
    as: "criadoPor",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Usuario,
    as: "resolvidoPor",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Usuario,
    as: "responsavel",
    attributes: ["id", "nome", "email"],
  },
  {
    model: Usuario,
    as: "funcionariosPermitidos",
    attributes: ["id", "nome", "email"],
    through: { attributes: [] },
  },
  {
    model: Loja,
    as: "loja",
    attributes: ["id", "nome"],
  },
  {
    model: Maquina,
    as: "maquina",
    attributes: ["id", "codigo", "nome", "tipo", "statusOperacao"],
  },
];

// Recalcula o statusOperacao da máquina a partir das manutenções em aberto.
const sincronizarStatusMaquina = async (maquinaId, transaction) => {
  if (!maquinaId) return;

  const maquina = await Maquina.findByPk(maquinaId, { transaction });
  if (!maquina) return;

  const manutencoesAbertas = await Manutencao.count({
    where: { maquinaId, status: { [Op.in]: STATUS_ABERTOS } },
    transaction,
  });

  if (manutencoesAbertas > 0) {
    if (maquina.statusOperacao !== "EM_MANUTENCAO") {
      await maquina.update({ statusOperacao: "EM_MANUTENCAO" }, { transaction });
    }
    return;
  }

  if (maquina.statusOperacao === "EM_MANUTENCAO") {
    const statusRestaurado = normalizarStatusOperacao({
      lojaId: maquina.lojaId,
      statusOperacao: undefined,
    });
    await maquina.update({ statusOperacao: statusRestaurado }, { transaction });
  }
};

// Avalia se a máquina está com manutenção repetida (recorrente).
const avaliarRecorrencia = async (maquinaId, tipoProblema, transaction) => {
  if (!maquinaId) return { recorrente: false, motivos: [] };

  const motivos = [];

  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_RECORRENCIA);

  const recentes = await Manutencao.count({
    where: { maquinaId, createdAt: { [Op.gte]: desde } },
    transaction,
  });

  if (recentes >= MINIMO_RECENTES_RECORRENCIA) {
    motivos.push(
      `Esta máquina já teve ${recentes} manutenções nos últimos ${DIAS_RECORRENCIA} dias.`,
    );
  }

  if (tipoProblema) {
    const mesmoTipo = await Manutencao.count({
      where: { maquinaId, tipoProblema },
      transaction,
    });

    if (mesmoTipo >= MINIMO_MESMO_TIPO_RECORRENCIA) {
      motivos.push(
        `O problema "${tipoProblema}" já se repetiu ${mesmoTipo} vezes nesta máquina.`,
      );
    }
  }

  return { recorrente: motivos.length > 0, motivos };
};

export const listarFuncionariosManutencao = async (req, res) => {
  try {
    const funcionarios = await Usuario.findAll({
      where: {
        role: "FUNCIONARIO",
        ativo: true,
      },
      attributes: ["id", "nome", "email"],
      order: [["nome", "ASC"]],
    });

    res.json(funcionarios);
  } catch (error) {
    console.error("Erro ao listar funcionários para manutenção:", error);
    res.status(500).json({ error: "Erro ao listar funcionários" });
  }
};

export const criarManutencao = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      titulo,
      descricao,
      funcionariosIds,
      custo,
      lojaId,
      maquinaId,
      responsavelId,
      tipoProblema,
      prazo,
    } = req.body;

    if (!titulo || !descricao) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Título e descrição são obrigatórios" });
    }

    if (!Array.isArray(funcionariosIds) || funcionariosIds.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Selecione ao menos um funcionário" });
    }

    const idsUnicos = [...new Set(funcionariosIds.filter(Boolean))];

    const custoInformado =
      custo !== undefined && custo !== null && custo !== "";
    const custoNumerico = custoInformado
      ? Number(String(custo).replace(",", "."))
      : null;

    if (
      custoInformado &&
      (!Number.isFinite(custoNumerico) || custoNumerico < 0)
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error:
          "Custo inválido. Informe um valor numérico maior ou igual a zero.",
      });
    }

    let maquina = null;
    if (maquinaId) {
      maquina = await Maquina.findByPk(maquinaId, { transaction });
      if (!maquina) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Máquina informada não encontrada" });
      }
    }

    // Manutenção de uma máquina pertence à loja dessa máquina.
    const lojaIdFinal = maquina ? maquina.lojaId : lojaId || null;

    if (custoInformado && custoNumerico > 0 && !lojaIdFinal) {
      await transaction.rollback();
      return res.status(400).json({
        error:
          "Selecione uma loja (ou uma máquina vinculada a uma loja) para registrar o gasto variável da manutenção.",
      });
    }

    const funcionarios = await Usuario.findAll({
      where: {
        id: { [Op.in]: idsUnicos },
        role: "FUNCIONARIO",
        ativo: true,
      },
      attributes: ["id"],
      transaction,
    });

    if (funcionarios.length !== idsUnicos.length) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Um ou mais funcionários informados são inválidos ou inativos",
      });
    }

    if (responsavelId) {
      const responsavel = await Usuario.findOne({
        where: { id: responsavelId, role: "FUNCIONARIO", ativo: true },
        attributes: ["id"],
        transaction,
      });

      if (!responsavel) {
        await transaction.rollback();
        return res.status(400).json({
          error: "Funcionário responsável inválido ou inativo",
        });
      }
    }

    if (lojaIdFinal && !maquina) {
      const loja = await Loja.findByPk(lojaIdFinal, { transaction });
      if (!loja) {
        await transaction.rollback();
        return res.status(400).json({ error: "Loja informada não encontrada" });
      }
    }

    const manutencao = await Manutencao.create(
      {
        titulo,
        descricao,
        custo: custoInformado ? custoNumerico : null,
        lojaId: lojaIdFinal,
        maquinaId: maquina ? maquina.id : null,
        responsavelId: responsavelId || null,
        tipoProblema: tipoProblema || null,
        prazo: prazo || null,
        criadoPorId: req.usuario.id,
      },
      { transaction },
    );

    await ManutencaoUsuario.bulkCreate(
      idsUnicos.map((usuarioId) => ({
        manutencaoId: manutencao.id,
        usuarioId,
      })),
      { transaction },
    );

    if (custoInformado && custoNumerico > 0 && lojaIdFinal) {
      const agora = new Date();
      await GastoVariavel.create(
        {
          lojaId: lojaIdFinal,
          nome: `Manutenção - ${titulo}`,
          valor: custoNumerico,
          observacao: `Gerado automaticamente pela manutenção ${manutencao.id}${descricao ? ` | ${descricao}` : ""}`,
          dataInicio: agora,
          dataFim: agora,
        },
        { transaction },
      );
    }

    await sincronizarStatusMaquina(manutencao.maquinaId, transaction);
    const { recorrente, motivos } = await avaliarRecorrencia(
      manutencao.maquinaId,
      manutencao.tipoProblema,
      transaction,
    );

    await transaction.commit();

    const manutencaoCompleta = await Manutencao.findByPk(manutencao.id, {
      include: includeAdmin,
    });

    res.locals.entityId = manutencao.id;
    res.status(201).json({
      ...manutencaoCompleta.toJSON(),
      recorrente,
      recorrenciaMotivos: motivos,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao criar manutenção:", error);
    res.status(500).json({ error: "Erro ao criar manutenção" });
  }
};

export const listarManutencoes = async (req, res) => {
  try {
    const { status, dataInicio, dataFim, lojaId, maquinaId, tipoProblema, usuarioId } =
      req.query;
    let include = [...includeAdmin];
    const where = {};

    if (!["ADMIN", "DESENVOLVEDOR"].includes(req.usuario.role)) {
      where.status = { [Op.ne]: "CONCLUIDA" };
      where[Op.or] = [
        { responsavelId: req.usuario.id },
        { "$funcionariosPermitidos.id$": req.usuario.id },
      ];
      include = [
        {
          model: Usuario,
          as: "criadoPor",
          attributes: ["id", "nome", "email", "role"],
        },
        {
          model: Usuario,
          as: "resolvidoPor",
          attributes: ["id", "nome", "email", "role"],
        },
        {
          model: Usuario,
          as: "responsavel",
          attributes: ["id", "nome", "email"],
        },
        {
          model: Usuario,
          as: "funcionariosPermitidos",
          attributes: ["id", "nome", "email"],
          through: { attributes: [] },
          required: false,
        },
        {
          model: Loja,
          as: "loja",
          attributes: ["id", "nome"],
        },
        {
          model: Maquina,
          as: "maquina",
          attributes: ["id", "codigo", "nome", "tipo", "statusOperacao"],
        },
      ];
    } else {
      if (status && STATUS_VALIDOS.includes(status)) {
        where.status = status;
      }

      if (lojaId) {
        where.lojaId = lojaId;
      }

      if (maquinaId) {
        where.maquinaId = maquinaId;
      }

      if (tipoProblema) {
        where.tipoProblema = tipoProblema;
      }

      if (dataInicio || dataFim) {
        where.createdAt = {};

        if (dataInicio) {
          where.createdAt[Op.gte] = new Date(`${dataInicio}T00:00:00.000Z`);
        }

        if (dataFim) {
          where.createdAt[Op.lte] = new Date(`${dataFim}T23:59:59.999Z`);
        }
      }

      if (usuarioId) {
        include = include.map((item) => {
          if (item.as !== "funcionariosPermitidos") return item;
          return {
            ...item,
            where: { id: usuarioId },
            required: true,
          };
        });
      }
    }

    const manutencoes = await Manutencao.findAll({
      where,
      include,
      subQuery: false,
      order: [["createdAt", "DESC"]],
    });

    res.json(manutencoes);
  } catch (error) {
    console.error("Erro ao listar manutenções:", error);
    res.status(500).json({ error: "Erro ao listar manutenções" });
  }
};

export const atualizarStatusManutencao = async (req, res) => {
  try {
    const { status } = req.body;

    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const manutencao = await Manutencao.findByPk(req.params.id, {
      include: [
        {
          model: Usuario,
          as: "funcionariosPermitidos",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    });

    if (!manutencao) {
      return res.status(404).json({ error: "Manutenção não encontrada" });
    }

    const usuarioPermitido =
      ["ADMIN", "DESENVOLVEDOR"].includes(req.usuario.role) ||
      manutencao.responsavelId === req.usuario.id ||
      manutencao.funcionariosPermitidos.some(
        (usuario) => usuario.id === req.usuario.id,
      );

    if (!usuarioPermitido) {
      return res.status(403).json({
        error: "Você não tem permissão para atualizar esta manutenção",
      });
    }

    if (manutencao.status === status) {
      return res
        .status(400)
        .json({ error: "A manutenção já está com este status" });
    }

    const dadosAtualizacao = { status };

    if (status === "CONCLUIDA") {
      dadosAtualizacao.resolvidoPorId = req.usuario.id;
      dadosAtualizacao.resolvidoEm = new Date();
    } else if (manutencao.status === "CONCLUIDA") {
      dadosAtualizacao.resolvidoPorId = null;
      dadosAtualizacao.resolvidoEm = null;
    }

    await manutencao.update(dadosAtualizacao);
    await sincronizarStatusMaquina(manutencao.maquinaId);

    const manutencaoAtualizada = await Manutencao.findByPk(manutencao.id, {
      include: includeAdmin,
    });

    res.json(manutencaoAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar status da manutenção:", error);
    res.status(500).json({ error: "Erro ao atualizar status da manutenção" });
  }
};

export const obterHistoricoMaquina = async (req, res) => {
  try {
    const { maquinaId } = req.params;

    const maquina = await Maquina.findByPk(maquinaId, {
      attributes: ["id", "codigo", "nome"],
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    const manutencoes = await Manutencao.findAll({
      where: { maquinaId },
      include: [
        {
          model: Usuario,
          as: "criadoPor",
          attributes: ["id", "nome", "email"],
        },
        {
          model: Usuario,
          as: "responsavel",
          attributes: ["id", "nome", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const { recorrente, motivos } = await avaliarRecorrencia(maquinaId, null);

    res.json({
      maquina,
      manutencoes,
      recorrente,
      recorrenciaMotivos: motivos,
    });
  } catch (error) {
    console.error("Erro ao obter histórico de manutenção da máquina:", error);
    res
      .status(500)
      .json({ error: "Erro ao obter histórico de manutenção da máquina" });
  }
};
