import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Fotos do projeto de loja (máximo 7 por projeto, validado no controller).
// O arquivo fica no Cloudinary; aqui só guarda a URL.
const ProjetoLojaMidia = sequelize.define(
  "ProjetoLojaMidia",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projetoLojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "projetos_loja",
        key: "id",
      },
    },
    url: {
      type: DataTypes.STRING(700),
      allowNull: false,
    },
    ordem: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "projeto_loja_midias",
    timestamps: true,
  },
);

export default ProjetoLojaMidia;
