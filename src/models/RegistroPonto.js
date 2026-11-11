import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Batida de ponto. Nunca é editada nem apagada: correção do admin entra como
// batida nova (origem AJUSTE) e a errada é marcada como desconsiderada — o
// original fica sempre no histórico.
const RegistroPonto = sequelize.define(
  "RegistroPonto",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // Número sequencial do comprovante (NSR)
    nsr: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      unique: true,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      field: "usuario_id",
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "ENTRADA, SAIDA_INTERVALO, VOLTA_INTERVALO ou SAIDA",
    },
    // Hora do servidor, nunca a do celular
    dataHora: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "data_hora",
    },
    // Dia de trabalho a que a batida pertence (horário de Brasília). Saída
    // depois da meia-noite fica no dia da entrada.
    dataReferencia: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "data_referencia",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },
    precisaoMetros: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "precisao_metros",
    },
    localPontoId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "locais_ponto", key: "id" },
      field: "local_ponto_id",
      comment: "Local cadastrado mais próximo na hora da batida",
    },
    distanciaMetros: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "distancia_metros",
    },
    foraDoLocal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "fora_do_local",
    },
    observacao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    origem: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "FUNCIONARIO",
      comment: "FUNCIONARIO (bateu no app) ou AJUSTE (lançada pelo admin)",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      field: "criado_por_id",
    },
    motivoAjuste: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "motivo_ajuste",
    },
    desconsiderada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    desconsideradaPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      field: "desconsiderada_por_id",
    },
    desconsideradaEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "desconsiderada_em",
    },
    motivoDesconsiderada: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "motivo_desconsiderada",
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    dispositivo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "registros_ponto",
    timestamps: true,
    indexes: [{ fields: ["usuario_id", "data_referencia"] }, { fields: ["data_hora"] }],
  },
);

export default RegistroPonto;
