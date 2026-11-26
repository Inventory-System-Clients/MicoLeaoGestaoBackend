import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Período marcado no calendário (ex.: Natal de 01/12 a 31/12, Black Friday).
// Só aparece como faixa no calendário; não é tarefa.
const PeriodoCalendario = sequelize.define(
  "PeriodoCalendario",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    titulo: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dataInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "data_inicio",
    },
    dataFim: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "data_fim",
    },
    cor: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "vermelho",
    },
    // Feriado (local): no ponto conta como feriado (extra 100%)
    feriado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "criado_por_id",
    },
  },
  {
    tableName: "periodos_calendario",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default PeriodoCalendario;
