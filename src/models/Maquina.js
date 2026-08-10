import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Maquina = sequelize.define(
  "Maquina",
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
      comment: "Ex: M01, M02, TK BALL",
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Ex: Agarra Mais, TakeBall",
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "lojas",
        key: "id",
      },
    },
    statusOperacao: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "EM_OPERACAO",
      field: "status_operacao",
      comment:
        "Status operacional: EM_OPERACAO, EM_MANUTENCAO, PRONTA_PARA_SAIDA, PARADA ou SEM_LOJA",
    },
    motivoParada: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "motivo_parada",
      comment: "Motivo pelo qual a máquina está com status PARADA",
    },
    capacidadePadrao: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      comment: "Quantidade máxima que a máquina comporta",
    },
    valorFicha: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 5.0,
      comment: "Valor em R$ de cada ficha",
    },
    fichasNecessarias: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fichas_necessarias",
      comment: "Quantidade de fichas necessárias para liberar uma jogada",
      validate: {
        min: 1,
      },
    },
    jogadasBoasPorPelucia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "jogadas_boas_por_pelucia",
      comment: "Quantidade ideal de jogadas para sair uma pelúcia",
    },
    forcaForte: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "forca_forte",
      comment: "Força forte da garra em percentual (0-100%)",
      validate: {
        min: 0,
        max: 100,
      },
    },
    forcaFraca: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "forca_fraca",
      comment: "Força fraca da garra em percentual (0-100%)",
      validate: {
        min: 0,
        max: 100,
      },
    },
    forcaPremium: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "forca_premium",
      comment: "Força premium da garra em percentual (0-100%)",
      validate: {
        min: 0,
        max: 100,
      },
    },
    jogadasPremium: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "jogadas_premium",
      comment: "Quantidade de jogadas para usar a força premium",
      validate: {
        min: 1,
      },
    },
    percentualAlertaEstoque: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Porcentagem mínima para alertar estoque baixo",
    },
    localizacao: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "Posição dentro da loja",
    },
    datasAuditoria: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: "datas_auditoria",
      comment: "Lista de datas (YYYY-MM-DD) em que a máquina passa por auditoria manual",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "maquinas",
    timestamps: true,
  }
);

export default Maquina;
