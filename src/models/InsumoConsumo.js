import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const InsumoConsumo = sequelize.define(
  "InsumoConsumo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    insumoId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "insumos",
        key: "id",
      },
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    pedidoPeluciaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "pedidos_pelucia",
        key: "id",
      },
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dataConsumo: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "insumo_consumos",
    timestamps: true,
  },
);

export default InsumoConsumo;
