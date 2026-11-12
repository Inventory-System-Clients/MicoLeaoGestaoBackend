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
    // Fluxo: SOLICITADA (qualquer um pede; Cadastro/admin autoriza) ->
    // PENDENTE (no setor/pessoa) -> ACEITA (alguém pegou) -> CONCLUIDA (quem
    // pegou terminou) -> FINALIZADA (admin lançou o gasto).
    // AGUARDANDO: quem pegou não conseguiu fazer; volta pro admin reenviar.
    // RECUSADA: a solicitação não foi autorizada.
    status: {
      type: DataTypes.ENUM(
        "SOLICITADA",
        "PENDENTE",
        "ACEITA",
        "AGUARDANDO",
        "CONCLUIDA",
        "FINALIZADA",
        "RECUSADA",
      ),
      allowNull: false,
      defaultValue: "PENDENTE",
    },
    // Destino: um setor (perfil de usuário — todos daquele perfil veem) ou
    // uma pessoa específica. Quando alguém aceita, só ela vê.
    setor: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    destinatarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    aceitaPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    aceitaEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    motivoAguardando: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Por que quem aceitou não conseguiu fazer (ex.: faltou peça)",
    },
    servicoExterno: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: "Serviço solicitado a terceiros (ex.: serralheiro)",
    },
    servicoSolicitadoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finalizadaPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    finalizadaEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    autorizadaPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    autorizadaEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    motivoRecusa: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gastoDescricao: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "O que foi gasto, informado pelo admin ao finalizar (valor fica em custo)",
    },
    historico: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: "Linha do tempo: [{ acao, status, usuarioId, usuarioNome, em, detalhe }]",
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
