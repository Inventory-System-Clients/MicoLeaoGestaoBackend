import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const CompraItem = sequelize.define(
  "CompraItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    compraId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "compra_id",
      references: {
        model: "compras",
        key: "id",
      },
    },
    tipoItem: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: "tipo_item",
      comment: "PRODUTO | INSUMO | PECA",
    },
    produtoId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "produto_id",
      references: {
        model: "produtos",
        key: "id",
      },
    },
    insumoId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "insumo_id",
      references: {
        model: "insumos",
        key: "id",
      },
    },
    pecaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "peca_id",
      references: {
        model: "pecas",
        key: "id",
      },
    },
    nomeItem: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "nome_item",
    },
    sku: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    quantidade: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    unidade: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    valorUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "valor_unitario",
    },
    valorTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "valor_total",
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "loja_id",
      references: {
        model: "lojas",
        key: "id",
      },
      comment: "Onde será usado (loja), opcional",
    },
    descricaoUso: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "descricao_uso",
      comment: "Onde será usado, texto livre complementar",
    },
  },
  {
    tableName: "compra_itens",
    timestamps: true,
  },
);

export default CompraItem;
