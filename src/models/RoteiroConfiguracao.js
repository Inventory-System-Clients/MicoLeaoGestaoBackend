import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const RoteiroConfiguracao = sequelize.define(
  "RoteiroConfiguracao",
  {
    id: {
      type: DataTypes.STRING(40),
      primaryKey: true,
      defaultValue: "global",
    },
    diaSemanaReset: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "dia_semana_reset",
    },
    horaReset: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "23:59",
      field: "hora_reset",
    },
    ultimoResetEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ultimo_reset_em",
    },
  },
  {
    tableName: "roteiro_configuracoes",
    timestamps: true,
  },
);

export default RoteiroConfiguracao;
