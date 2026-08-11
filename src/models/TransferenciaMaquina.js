import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const TransferenciaMaquina = sequelize.define(
  "TransferenciaMaquina",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    maquinaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "maquinas",
        key: "id",
      },
    },
    lojaOrigemId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "lojas",
        key: "id",
      },
      comment: "Loja de onde a máquina saiu (nulo se estava no galpão)",
    },
    lojaDestinoId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "lojas",
        key: "id",
      },
      comment: "Loja para onde a máquina foi (nulo se foi para o galpão)",
    },
    dataTransferencia: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Quem registrou a transferência",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "transferencias_maquina",
    timestamps: true,
  },
);

export default TransferenciaMaquina;
