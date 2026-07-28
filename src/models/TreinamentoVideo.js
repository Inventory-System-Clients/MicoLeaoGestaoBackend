import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const TreinamentoVideo = sequelize.define(
  "TreinamentoVideo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    categoria: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "Geral",
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipoUsuario: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "TODOS",
      field: "tipo_usuario",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "criado_por_id",
    },
  },
  {
    tableName: "treinamento_videos",
    timestamps: true,
  },
);

export default TreinamentoVideo;
