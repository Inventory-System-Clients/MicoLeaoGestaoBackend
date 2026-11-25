import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Shopping: agrupa lojas (Loja.shoppingId) e máquinas avulsas, que ficam no
// shopping sem loja (Maquina.shoppingId com lojaId vazio). Loja de rua fica
// sem shopping.
const Shopping = sequelize.define(
  "Shopping",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    endereco: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    cidade: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "shoppings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Shopping;
