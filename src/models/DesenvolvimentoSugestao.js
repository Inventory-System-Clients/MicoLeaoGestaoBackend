import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const DesenvolvimentoSugestao = sequelize.define(
  "DesenvolvimentoSugestao",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    resposta: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    motivoRevisao: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "motivo_revisao",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "criado_por_id",
      references: { model: "usuarios", key: "id" },
    },
    respondidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "respondido_por_id",
      references: { model: "usuarios", key: "id" },
    },
    desenvolvidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "desenvolvido_por_id",
      references: { model: "usuarios", key: "id" },
    },
    baixadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "baixado_por_id",
      references: { model: "usuarios", key: "id" },
    },
    baixadoEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "baixado_em",
    },
  },
  {
    tableName: "desenvolvimento_sugestoes",
    timestamps: true,
  },
);

export default DesenvolvimentoSugestao;
