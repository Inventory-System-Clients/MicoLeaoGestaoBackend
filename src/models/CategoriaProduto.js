import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Categorias de produto cadastradas (o produto guarda o nome em
// produtos.categoria, como sempre)
const CategoriaProduto = sequelize.define(
  "CategoriaProduto",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nome: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  },
  {
    tableName: "categorias_produto",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default CategoriaProduto;
