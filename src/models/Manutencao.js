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
    pecaPlanejadaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "pecas",
        key: "id",
      },
      comment: "Peça escolhida na criação, ainda não descontada do carrinho",
    },
    pecaPlanejadaFuncionarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      comment: "Funcionário do carrinho de onde a peça planejada vai sair",
    },
    pecaPlanejadaQuantidade: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pecaPlanejadaObservacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pecaPlanejadaConsumida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "Vira true quando a manutenção é concluída e a peça planejada é efetivamente descontada do carrinho",
    },
  },
  {
    tableName: "manutencoes",
    timestamps: true,
  },
);

export default Manutencao;
