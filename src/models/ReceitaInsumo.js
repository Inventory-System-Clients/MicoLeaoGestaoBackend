import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ReceitaInsumo = sequelize.define(
  "ReceitaInsumo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    produtoId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "produtos",
        key: "id",
      },
    },
    insumoId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "insumos",
        key: "id",
      },
    },
    quantidadePorUnidade: {
      type: DataTypes.DECIMAL(12, 6),
      allowNull: false,
      validate: {
        min: 0,
      },
      comment: "Quantidade de insumo gasta para produzir 1 unidade do produto",
    },
  },
  {
    tableName: "receita_insumos",
    timestamps: true,
  },
);

export default ReceitaInsumo;
