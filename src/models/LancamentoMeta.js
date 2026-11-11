import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Dinheiro que entrou na loja, lançado pelo financeiro: soma no realizado da
// meta do mês da data.
const LancamentoMeta = sequelize.define(
  "LancamentoMeta",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "lojas", key: "id" },
      field: "loja_id",
    },
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    valor: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    observacao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      field: "criado_por_id",
    },
  },
  {
    tableName: "lancamentos_meta",
    timestamps: true,
    indexes: [{ fields: ["loja_id", "data"] }],
  },
);

export default LancamentoMeta;
