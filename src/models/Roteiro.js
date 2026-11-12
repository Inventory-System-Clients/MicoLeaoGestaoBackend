import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Roteiro = sequelize.define(
  "Roteiro",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    // Rota do motorista (desde 2026-11-12): viagem com início marcado e fim
    // quando o motorista finaliza. No início o veículo fica em uso; no fim é
    // devolvido. Status: AGENDADA -> EM_ANDAMENTO -> FINALIZADA.
    dataInicio: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "data_inicio",
    },
    dataFim: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "data_fim",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "AGENDADA",
    },
    iniciadaEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "iniciada_em",
    },
    kmInicial: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "km_inicial",
    },
    kmFinal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "km_final",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "criado_por_id",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "usuario_id",
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    veiculoId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "veiculo_id",
      references: {
        model: "veiculos",
        key: "id",
      },
    },
    todosDias: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "todos_dias",
    },
    diasSemana: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: "dias_semana",
    },
    resetsAgendados: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [{ diaSemana: 0, hora: "23:59" }],
      field: "resets_agendados",
      comment: "Lista de pares { diaSemana (0-6), hora (HH:MM) } de reset",
    },
    ultimoResetEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ultimo_reset_em",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "roteiros",
    timestamps: true,
  },
);

export default Roteiro;
