import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Pedido de compra sugerido pelo Funcionário de Estoque (produto/insumo/peça
// + quantidade), que o Admin aceita (vira um pedido de compra de verdade,
// pra completar fornecedor/valor) ou recusa (com motivo).
const SugestaoCompra = sequelize.define(
  "SugestaoCompra",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDENTE",
      comment: "PENDENTE | ACEITA | RECUSADA",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resposta: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Motivo informado pelo Admin ao recusar",
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
    respondidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "respondido_por_id",
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    respondidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "respondido_em",
    },
    compraGeradaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "compra_gerada_id",
      references: {
        model: "compras",
        key: "id",
      },
      comment: "Pedido de compra criado automaticamente quando a sugestão é aceita",
    },
  },
  {
    tableName: "sugestoes_compra",
    timestamps: true,
  },
);

export default SugestaoCompra;
