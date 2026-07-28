import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ManutencaoPeca = sequelize.define(
  "ManutencaoPeca",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    manutencaoId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "manutencoes",
        key: "id",
      },
    },
    pecaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "pecas",
        key: "id",
      },
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Funcionário que usou a peça",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dataUso: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "manutencao_pecas",
    timestamps: true,
  },
);

export default ManutencaoPeca;
