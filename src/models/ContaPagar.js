import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ContaPagar = sequelize.define(
  "ContaPagar",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    origem: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "COMPRA | AVULSO",
    },
    compraId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "compra_id",
      references: {
        model: "compras",
        key: "id",
      },
    },
    fornecedorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "fornecedor_id",
      references: {
        model: "fornecedores",
        key: "id",
      },
    },
    descricao: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    numeroParcela: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "numero_parcela",
    },
    totalParcelas: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "total_parcelas",
    },
    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    moeda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL",
    },
    cotacaoDolar: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      field: "cotacao_dolar",
    },
    valorBrl: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "valor_brl",
    },
    vencimento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    formaPagamento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "forma_pagamento",
      comment: "PIX | DINHEIRO | BOLETO",
    },
    status: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "PENDENTE",
      comment: "PENDENTE | PAGA",
    },
    pagoEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "pago_em",
    },
    pagoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "pago_por_id",
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "criado_por_id",
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "contas_pagar",
    timestamps: true,
  },
);

export default ContaPagar;
