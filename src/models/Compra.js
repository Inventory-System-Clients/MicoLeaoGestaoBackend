import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Compra = sequelize.define(
  "Compra",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fornecedorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "fornecedores",
        key: "id",
      },
    },
    moeda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL",
    },
    tipoPagamento: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "ANTECIPADO | PARCELADO | A_VISTA",
    },
    quantidadeParcelas: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    formaPagamento: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "PIX | DINHEIRO | BOLETO",
    },
    fotoUrl: {
      type: DataTypes.STRING(700),
      allowNull: true,
      comment: "Foto da nota/orçamento/produto",
    },
    dataCompra: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    compradorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    recebidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    recebidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    possuiPendencia: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "true quando a conferência de recebimento aponta itens em falta",
    },
    status: {
      type: DataTypes.ENUM("PESQUISANDO", "COMPRADO", "RECEBIDO"),
      allowNull: false,
      defaultValue: "PESQUISANDO",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
  },
  {
    tableName: "compras",
    timestamps: true,
  },
);

export default Compra;
