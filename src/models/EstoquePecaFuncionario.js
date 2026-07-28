import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const EstoquePecaFuncionario = sequelize.define(
  "EstoquePecaFuncionario",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    funcionarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
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
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: "Quantidade em estoque com o funcionário",
    },
  },
  {
    tableName: "estoque_pecas_funcionario",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["funcionarioId", "pecaId"],
      },
    ],
  },
);

export default EstoquePecaFuncionario;
