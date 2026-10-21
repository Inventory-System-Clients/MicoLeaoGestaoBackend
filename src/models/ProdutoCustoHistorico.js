import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Histórico do custoUnitario do produto (na tela: "Custo pelúcia"), alterado
// pelo cadastro do produto ou pelo recebimento de compra.
// Cada troca de valor gera uma linha nova com a data em que passou a valer —
// as linhas nunca são editadas nem apagadas, então o custo de saídas antigas
// continua sendo o que valia na data delas.
const ProdutoCustoHistorico = sequelize.define(
  "ProdutoCustoHistorico",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    produtoId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    custo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "custoUnitario do produto a partir de vigenteDesde",
    },
    vigenteDesde: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "Momento em que esse custo passou a valer",
    },
    compraId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment:
        "Compra cujo recebimento gerou essa troca (null = troca manual no cadastro). Se o recebimento for desfeito, a linha é apagada.",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "Quem registrou a troca de valor",
    },
  },
  {
    tableName: "produto_custo_historico",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["produtoId", "vigenteDesde"] }],
  },
);

export default ProdutoCustoHistorico;
