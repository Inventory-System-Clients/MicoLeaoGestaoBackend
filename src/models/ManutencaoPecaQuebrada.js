import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ManutencaoPecaQuebrada = sequelize.define(
  "ManutencaoPecaQuebrada",
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
    funcionarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Funcionário que devolveu a peça quebrada",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dataDevolucao: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "manutencao_pecas_quebradas",
    timestamps: true,
  },
);

export default ManutencaoPecaQuebrada;
