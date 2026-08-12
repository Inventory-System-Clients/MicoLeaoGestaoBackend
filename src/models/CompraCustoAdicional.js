import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const CompraCustoAdicional = sequelize.define(
  "CompraCustoAdicional",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    compraId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "compra_id",
      references: {
        model: "compras",
        key: "id",
      },
    },
    descricao: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    formaPagamento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "forma_pagamento",
      comment: "PIX | DINHEIRO | BOLETO",
    },
  },
  {
    tableName: "compra_custos_adicionais",
    timestamps: true,
  },
);

export default CompraCustoAdicional;
