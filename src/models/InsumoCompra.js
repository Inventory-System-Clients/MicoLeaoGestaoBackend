import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const InsumoCompra = sequelize.define(
  "InsumoCompra",
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
    custoUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    custoTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    fornecedorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "fornecedores",
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
    dataCompra: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "insumo_compras",
    timestamps: true,
  },
);

export default InsumoCompra;
