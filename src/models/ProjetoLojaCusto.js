import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ProjetoLojaCusto = sequelize.define(
  "ProjetoLojaCusto",
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
    categoria: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Texto livre, ex: Obras, Letreiro e Cenografia",
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    valor: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "projeto_loja_custos",
    timestamps: true,
  },
);

export default ProjetoLojaCusto;
