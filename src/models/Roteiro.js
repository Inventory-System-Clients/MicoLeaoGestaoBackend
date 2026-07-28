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
    diaSemanaReset: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "dia_semana_reset",
    },
    horaReset: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "23:59",
      field: "hora_reset",
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
