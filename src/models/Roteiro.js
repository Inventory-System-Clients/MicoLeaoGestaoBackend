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
