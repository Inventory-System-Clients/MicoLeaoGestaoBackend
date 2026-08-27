import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Cadastro simples: só o nome de quem transporta o envio, sem login nem
// senha. Quem dá baixa no envio é o Funcionário de Estoque; o transportador
// nunca acessa o sistema.
const Transportador = sequelize.define(
  "Transportador",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "transportadores",
    timestamps: true,
  },
);

export default Transportador;
