import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Manutencao = sequelize.define(
  "Manutencao",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    titulo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    custo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "lojas",
        key: "id",
      },
    },
    maquinaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "maquinas",
        key: "id",
      },
    },
    responsavelId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    tipoProblema: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    prazo: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Prazo/data de aviso para conclusão da manutenção",
    },
    status: {
      type: DataTypes.ENUM(
        "ABERTA",
        "EM_ANDAMENTO",
        "AGUARDANDO_PECA",
        "CONCLUIDA",
      ),
      allowNull: false,
      defaultValue: "ABERTA",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    resolvidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    resolvidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "manutencoes",
    timestamps: true,
  },
);

export default Manutencao;
