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
    tipoValor: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "FIXO",
      field: "tipo_valor",
      comment: "FIXO | PERCENTUAL — se PERCENTUAL, o campo valor guarda a porcentagem (ex: 10 = 10%)",
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Valor em dinheiro (tipoValor=FIXO) ou porcentagem (tipoValor=PERCENTUAL)",
    },
    baseCalculo: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "base_calculo",
      comment: "SEM_DESCONTO | COM_DESCONTO — só usado quando tipoValor=PERCENTUAL, define sobre qual total dos itens a porcentagem incide",
    },
    moeda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL",
      comment: "BRL | USD — moeda deste custo adicional, pode ser diferente da moeda do pedido",
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
