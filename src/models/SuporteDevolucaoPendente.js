import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const SuporteDevolucaoPendente = sequelize.define(
  "SuporteDevolucaoPendente",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    itemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "suporte_itens",
        key: "id",
      },
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    motivo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PENDENTE", "CONCLUIDA"),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    movimentacaoOrigemId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "suporte_movimentacoes",
        key: "id",
      },
    },
    movimentacaoResolucaoId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "suporte_movimentacoes",
        key: "id",
      },
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
  },
  {
    tableName: "suporte_devolucoes_pendentes",
    timestamps: true,
  },
);

export default SuporteDevolucaoPendente;
