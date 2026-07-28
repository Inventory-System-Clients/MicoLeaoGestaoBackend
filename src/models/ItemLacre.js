import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ItemLacre = sequelize.define(
  "ItemLacre",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lacreId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "lacres",
        key: "id",
      },
    },
    produtoId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "produtos",
        key: "id",
      },
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
  },
  {
    tableName: "itens_lacre",
    timestamps: true,
  },
);

export default ItemLacre;
