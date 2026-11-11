import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Meta do mês de uma loja: três níveis de faturamento (bronze < prata < ouro).
// O realizado é a soma dos lançamentos do financeiro no mês (LancamentoMeta).
const MetaLoja = sequelize.define(
  "MetaLoja",
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
    // "2026-11"
    mes: {
      type: DataTypes.STRING(7),
      allowNull: false,
    },
    valorBronze: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "valor_bronze",
    },
    valorPrata: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "valor_prata",
    },
    valorOuro: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "valor_ouro",
    },
    atualizadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      field: "atualizado_por_id",
    },
  },
  {
    tableName: "metas_loja",
    timestamps: true,
    indexes: [{ unique: true, fields: ["loja_id", "mes"] }],
  },
);

export default MetaLoja;
