import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Peca = sequelize.define(
  "Peca",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    codigo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unidade: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Ex: un, kg, m",
    },
    quantidadeEstoque: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment: "Saldo central da peça",
    },
    estoqueMinimo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: "Quantidade mínima para alerta de estoque baixo",
    },
    quantidadeQuebrada: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
      comment:
        "Peças devolvidas quebradas em manutenções, aguardando descarte/conserto/reposição — separado do estoque bom",
    },
    custoUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "pecas",
    timestamps: true,
  },
);

export default Peca;
