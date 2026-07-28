import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Fornecedor = sequelize.define(
  "Fornecedor",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    contato: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    telefoneWhatsapp: {
      type: DataTypes.STRING(40),
      allowNull: true,
      field: "telefone_whatsapp",
    },
    cidade: {
      type: DataTypes.STRING(120),
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
    tableName: "fornecedores",
    timestamps: true,
  },
);

export default Fornecedor;
