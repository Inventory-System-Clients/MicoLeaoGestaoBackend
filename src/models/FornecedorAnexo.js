import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const FornecedorAnexo = sequelize.define(
  "FornecedorAnexo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fornecedorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "fornecedor_id",
      references: {
        model: "fornecedores",
        key: "id",
      },
    },
    titulo: {
      type: DataTypes.STRING(140),
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING(700),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "ORCAMENTO",
    },
  },
  {
    tableName: "fornecedor_anexos",
    timestamps: true,
  },
);

export default FornecedorAnexo;
