import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const GastoFixoLoja = sequelize.define(
  "GastoFixoLoja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "lojaid",
    },
    nome: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    valor: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    vigenciaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "vigencia_inicio",
      comment:
        "A partir de qual mês esse gasto passa a valer. Vazio = vale desde sempre.",
    },
    vigenciaFim: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "vigencia_fim",
      comment:
        "Até qual mês esse gasto vale. Vazio = continua valendo indefinidamente. Pra um gasto de mês único, use o mesmo mês em início e fim.",
    },
  },
  {
    tableName: "GastoFixoLoja",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["lojaid"] },
      { unique: true, fields: ["lojaid", "nome"] },
    ],
  },
);

export default GastoFixoLoja;
