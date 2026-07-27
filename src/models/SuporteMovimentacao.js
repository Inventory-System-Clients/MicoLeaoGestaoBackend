import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const SuporteMovimentacao = sequelize.define(
  "SuporteMovimentacao",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    itemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "suporte_itens",
        key: "id",
      },
    },
    tipo: {
      type: DataTypes.ENUM("ENTRADA", "SAIDA"),
      allowNull: false,
    },
    categoria: {
      type: DataTypes.ENUM("VENDA", "TROCA", "COMPRA", "DEVOLUCAO"),
      allowNull: true,
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    motivo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    quantidadeAnterior: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantidadeAtual: {
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
    },
  },
  {
    tableName: "suporte_movimentacoes",
    timestamps: true,
  },
);

export default SuporteMovimentacao;
