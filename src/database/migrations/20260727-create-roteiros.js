"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("roteiros", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      nome: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      usuario_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
      },
      veiculo_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "veiculos", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      todos_dias: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      dias_semana: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      ativo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("roteiro_itens", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      roteiro_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "roteiros", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tipo: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "LOJA",
      },
      loja_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "lojas", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      anotacao: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ordem: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      concluido: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      concluido_em: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      maquinas_concluidas: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.createTable("roteiro_configuracoes", {
      id: {
        type: Sequelize.STRING(40),
        primaryKey: true,
        allowNull: false,
        defaultValue: "global",
      },
      dia_semana_reset: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      hora_reset: {
        type: Sequelize.STRING(5),
        allowNull: false,
        defaultValue: "23:59",
      },
      ultimo_reset_em: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("roteiro_configuracoes");
    await queryInterface.dropTable("roteiro_itens");
    await queryInterface.dropTable("roteiros");
  },
};
