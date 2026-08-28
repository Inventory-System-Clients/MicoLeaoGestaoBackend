import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ProjetoLoja = sequelize.define(
  "ProjetoLoja",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "lojas",
        key: "id",
      },
      comment: "Vínculo opcional com a loja real, se já tiver sido cadastrada",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PLANEJAMENTO",
      comment: "PLANEJAMENTO | EM_ANDAMENTO | CONCLUIDO | CANCELADO",
    },
    dataPrevisaoAbertura: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    observacoes: {
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
    tableName: "projetos_loja",
    timestamps: true,
  },
);

export default ProjetoLoja;
