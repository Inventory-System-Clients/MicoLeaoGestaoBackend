import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Insumo = sequelize.define(
  "Insumo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    unidade: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Ex: kg, un, m, litro",
    },
    quantidadeEstoque: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: "Saldo atual em estoque do insumo",
    },
    estoqueMinimo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Quantidade mínima para alerta de estoque baixo",
    },
    custoUnitarioUltimo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Custo unitário da última compra registrada",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "insumos",
    timestamps: true,
  },
);

export default Insumo;
