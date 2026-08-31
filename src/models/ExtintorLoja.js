import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ExtintorLoja = sequelize.define(
  "ExtintorLoja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "lojaid",
    },
    identificacao: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Local/identificação do extintor (ex: corredor, cozinha). Opcional.",
    },
    numero: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Número/numeração de identificação do extintor. Opcional.",
    },
    dataVencimento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "data_vencimento",
    },
  },
  {
    tableName: "ExtintorLoja",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ fields: ["lojaid"] }],
  },
);

export default ExtintorLoja;
