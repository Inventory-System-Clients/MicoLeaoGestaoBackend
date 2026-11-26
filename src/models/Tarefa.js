import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Tarefa agendada (Análise > Tarefas e Calendário). Quem cria escolhe para
// quem é (responsável) e o dia. O responsável aceita e, quando fizer, marca
// "Feito". Tarefa com ação (transferir máquina, pagar conta...) faz a ação
// sozinha no "Feito" (ver services/tarefaAcoes.js).
//
// Status: PENDENTE (esperando o responsável aceitar) -> ACEITA -> FEITA.
// O responsável pode recusar (RECUSADA); quem criou ou o admin pode cancelar
// (CANCELADA). Tarefas automáticas (extintor e contrato vencendo) nascem sem
// responsável; o admin escolhe quem faz. Tarefa manual também pode ficar sem
// responsável (não é para alguém em especial): quem criou ou o admin pega
// para si, escolhe alguém depois ou marca Feito direto.
const Tarefa = sequelize.define(
  "Tarefa",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // Número que aparece na tela: TAR-0001
    codigo: {
      type: DataTypes.VIRTUAL,
      get() {
        const id = this.getDataValue("id");
        return id ? `TAR-${String(id).padStart(4, "0")}` : null;
      },
    },
    titulo: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "LIVRE",
      comment:
        "LIVRE | TRANSFERIR_MAQUINA | STATUS_MAQUINA | PRECO_MAQUINA | PAGAR_CONTA | TROCAR_EXTINTOR | RENOVAR_CONTRATO",
    },
    // Parâmetros da ação (maquinaId, lojaDestinoId, contaPagarId...)
    dados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Dia em que a tarefa deve ser feita (ou o 1º dia, se tiver dataFim)",
    },
    // Tarefa de período (ex.: decoração de Natal de 01/12 a 31/12). Vazio =
    // tarefa de um dia só. O prazo (atrasada) passa a ser o último dia.
    dataFim: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "data_fim",
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "loja_id",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDENTE",
      comment: "PENDENTE | ACEITA | FEITA | RECUSADA | CANCELADA",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "criado_por_id",
      comment: "Vazio = criada pelo sistema (automática)",
    },
    responsavelId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "responsavel_id",
    },
    // Pessoas da tarefa (várias). responsavelId é a 1ª (principal). Qualquer
    // uma aceita e marca Feito; a tarefa é do grupo.
    pessoasIds: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: "pessoas_ids",
    },
    aceitaEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "aceita_em",
    },
    feitaEm: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "feita_em",
    },
    feitaPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "feita_por_id",
    },
    motivoRecusa: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "motivo_recusa",
    },
    // O que a ação fez no "Feito" (ex.: transferência criada, nova validade)
    resultado: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    // Tarefa criada pelo sistema: "EXTINTOR:<id>:<validade>" ou
    // "CONTRATO:<lojaId>:<fim>". Evita criar a mesma tarefa duas vezes.
    origem: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    automatica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // [{ em, porId, porNome, acao, detalhe }]
    historico: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "tarefas",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["data"] },
      { fields: ["status"] },
      { fields: ["responsavel_id"] },
      { fields: ["criado_por_id"] },
      { fields: ["origem"] },
    ],
  },
);

export default Tarefa;
