import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const RoteiroItem = sequelize.define(
  "RoteiroItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    roteiroId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "roteiro_id",
      references: {
        model: "roteiros",
        key: "id",
      },
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "LOJA",
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "loja_id",
      references: {
        model: "lojas",
        key: "id",
      },
    },
    anotacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ordem: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "roteiro_itens",
    timestamps: true,
  },
);

export default RoteiroItem;
