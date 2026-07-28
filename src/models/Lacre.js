import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Lacre = sequelize.define(
  "Lacre",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    envioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "envios",
        key: "id",
      },
    },
    numero: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: "Número físico do lacre",
    },
    status: {
      type: DataTypes.ENUM("SEPARADO", "EM_TRANSITO", "CONFERIDO", "DIVERGENTE"),
      allowNull: false,
      defaultValue: "SEPARADO",
    },
    numeroDigitado: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Número digitado na conferência",
    },
    conferidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    conferidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "lacres",
    timestamps: true,
  },
);

export default Lacre;
