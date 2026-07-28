import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ModoSeguranca = sequelize.define(
  "ModoSeguranca",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    motivo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ativadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "ativado_por_id",
      references: { model: "usuarios", key: "id" },
    },
    ativadoEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ativado_em",
    },
    desativadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "desativado_por_id",
      references: { model: "usuarios", key: "id" },
    },
    desativadoEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "desativado_em",
    },
  },
  {
    tableName: "modo_seguranca",
    timestamps: true,
  },
);

export default ModoSeguranca;
