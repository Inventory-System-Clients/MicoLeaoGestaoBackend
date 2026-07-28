import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const FornecedorProduto = sequelize.define(
  "FornecedorProduto",
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
    produtoNome: {
      type: DataTypes.STRING(160),
      allowNull: false,
      field: "produto_nome",
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unidade: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "un",
    },
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "fornecedor_produtos",
    timestamps: true,
  },
);

export default FornecedorProduto;
