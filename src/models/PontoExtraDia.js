import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Dia com hora extra que vai ser pago como diária (e não como hora extra).
// Sem registro: o dia é pago como hora extra (50% ou 100%).
const PontoExtraDia = sequelize.define(
  "PontoExtraDia",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    usuarioId: { type: DataTypes.UUID, allowNull: false, field: "usuario_id" },
    dia: { type: DataTypes.DATEONLY, allowNull: false },
    forma: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "DIARIA" },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    observacao: { type: DataTypes.STRING(255), allowNull: true },
    criadoPorId: { type: DataTypes.UUID, allowNull: true, field: "criado_por_id" },
  },
  {
    tableName: "ponto_extras_dia",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ unique: true, fields: ["usuario_id", "dia"] }],
  },
);

export default PontoExtraDia;
