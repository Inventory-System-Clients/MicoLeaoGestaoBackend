import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Pessoas da rota (motorista, consultora, gestora...). Qualquer uma inicia,
// confere as paradas e finaliza. Roteiro.usuarioId continua sendo a pessoa
// principal (a 1ª da lista), usada no veículo e no início automático.
const RoteiroUsuario = sequelize.define(
  "RoteiroUsuario",
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
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "usuario_id",
    },
  },
  {
    tableName: "roteiro_usuarios",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["roteiro_id", "usuario_id"] }, { fields: ["usuario_id"] }],
  },
);

export default RoteiroUsuario;
