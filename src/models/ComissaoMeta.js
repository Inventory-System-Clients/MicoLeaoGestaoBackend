import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Comissão de um usuário numa meta: por nível atingido, valor fixo (R$) ou
// porcentagem do realizado. Vale o maior nível que a loja alcançou.
const ComissaoMeta = sequelize.define(
  "ComissaoMeta",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    metaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "metas_loja", key: "id" },
      onDelete: "CASCADE",
      field: "meta_id",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      field: "usuario_id",
    },
    tipo: {
      type: DataTypes.STRING(12),
      allowNull: false,
      defaultValue: "FIXO",
      comment: "FIXO (R$) ou PERCENTUAL (% do realizado)",
    },
    bronze: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    prata: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    ouro: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "comissoes_meta",
    timestamps: true,
    indexes: [{ unique: true, fields: ["meta_id", "usuario_id"] }],
  },
);

export default ComissaoMeta;
