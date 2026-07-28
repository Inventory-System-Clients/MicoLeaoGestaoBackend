import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Envio = sequelize.define(
  "Envio",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lojaDestinoId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "lojas",
        key: "id",
      },
    },
    separadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Quem separou/montou o envio no depósito",
    },
    transportadorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Funcionário/entregador que está levando o envio",
    },
    despachadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    despachadoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "envios",
    timestamps: true,
  },
);

export default Envio;
