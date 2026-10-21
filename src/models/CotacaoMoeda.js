import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Histórico da cotação de moeda estrangeira em real (Financeiro > Configuração
// de moeda). Cada troca gera uma linha nova com a data em que passou a valer;
// as linhas nunca são editadas nem apagadas, então conversões de compras já
// recebidas continuam com a cotação da época.
const CotacaoMoeda = sequelize.define(
  "CotacaoMoeda",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    moeda: {
      type: DataTypes.STRING(3),
      allowNull: false,
      comment: "Código da moeda estrangeira, ex: USD",
    },
    valorEmReal: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      comment: "Quanto 1 unidade da moeda vale em real (R$)",
    },
    vigenteDesde: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Momento em que essa cotação passou a valer",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Quem registrou a troca de cotação",
    },
  },
  {
    tableName: "cotacao_moeda_historico",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["moeda", "vigenteDesde"] }],
  },
);

export default CotacaoMoeda;
