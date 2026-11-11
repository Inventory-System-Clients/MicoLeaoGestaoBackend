import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Lugar onde é esperado bater o ponto (loja, depósito, escritório). A batida
// é comparada com o local mais próximo: fora do raio fica marcada pro admin.
const LocalPonto = sequelize.define(
  "LocalPonto",
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
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "lojas", key: "id" },
      field: "loja_id",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false,
    },
    raioMetros: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 200,
      field: "raio_metros",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "locais_ponto",
    timestamps: true,
  },
);

export default LocalPonto;
