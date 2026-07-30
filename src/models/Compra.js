import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Compra = sequelize.define(
  "Compra",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nomeItem: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    produtoId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "produtos",
        key: "id",
      },
    },
    insumoId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "insumos",
        key: "id",
      },
    },
    pecaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "pecas",
        key: "id",
      },
    },
    fornecedorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "fornecedores",
        key: "id",
      },
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "lojas",
        key: "id",
      },
      comment: "Onde será usado (loja), opcional",
    },
    descricaoUso: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Onde será usado, texto livre complementar",
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
    },
    valorTotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    fotoUrl: {
      type: DataTypes.STRING(700),
      allowNull: true,
      comment: "Foto da nota/orçamento/produto",
    },
    dataCompra: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    compradorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    recebidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    recebidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("PESQUISANDO", "APROVADO", "COMPRADO", "RECEBIDO"),
      allowNull: false,
      defaultValue: "PESQUISANDO",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "compras",
    timestamps: true,
  },
);

export default Compra;
