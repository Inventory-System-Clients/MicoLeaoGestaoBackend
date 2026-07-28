import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const PedidoPelucia = sequelize.define(
  "PedidoPelucia",
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
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PENDENTE", "CONCLUIDO"),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    concluidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    concluidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    movimentacaoEstoqueLojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "movimentacao_estoque_lojas",
        key: "id",
      },
    },
  },
  {
    tableName: "pedidos_pelucia",
    timestamps: true,
  },
);

export default PedidoPelucia;
