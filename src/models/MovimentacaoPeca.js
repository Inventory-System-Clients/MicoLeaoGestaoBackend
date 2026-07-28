import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const MovimentacaoPeca = sequelize.define(
  "MovimentacaoPeca",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    pecaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "pecas",
        key: "id",
      },
    },
    funcionarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Funcionário que recebeu a peça",
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
      comment: "Quem enviou a peça (admin)",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dataEnvio: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "movimentacoes_pecas",
    timestamps: true,
  },
);

export default MovimentacaoPeca;
