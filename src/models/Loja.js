import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const Loja = sequelize.define(
  "Loja",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    endereco: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    cidade: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    responsavel: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    telefone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    statusOperacao: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "ATIVA",
      field: "status_operacao",
      comment: "Status operacional: ATIVA, INATIVA ou EM_IMPLANTACAO",
    },
    dataInicio: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "data_inicio",
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dataVencimentoExtintor: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "data_vencimento_extintor",
    },
    dataFimContrato: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "data_fim_contrato",
    },
    diasAvisoContrato: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 60,
      field: "dias_aviso_contrato",
      comment: "Quantos dias antes do fim do contrato o sistema deve avisar",
    },
    contratoAvisoAdiadoDias: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "contrato_aviso_adiado_dias",
      comment:
        "Quando preenchido, adia o alerta de contrato: só volta a avisar quando faltar esse tanto de dias (ou menos). Zerado automaticamente quando a data de fim do contrato muda.",
    },
    valorFichaPadrao: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 2.5,
      comment: "Valor padrão da ficha da loja em R$",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "lojas",
    timestamps: true,
  },
);

export default Loja;
