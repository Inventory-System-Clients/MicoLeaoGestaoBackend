import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const TreinamentoFeedback = sequelize.define(
  "TreinamentoFeedback",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "usuario_id",
    },
    mensagem: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "OBSERVACAO",
    },
    visualizado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "treinamento_feedbacks",
    timestamps: true,
  },
);

export default TreinamentoFeedback;
