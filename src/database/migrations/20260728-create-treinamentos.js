"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("treinamento_videos", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      titulo: { type: Sequelize.STRING(160), allowNull: false },
      categoria: {
        type: Sequelize.STRING(80),
        allowNull: false,
        defaultValue: "Geral",
      },
      link: { type: Sequelize.STRING(500), allowNull: false },
      descricao: { type: Sequelize.TEXT, allowNull: true },
      tipo_usuario: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "TODOS",
      },
      ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      criado_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.createTable("treinamento_feedbacks", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      usuario_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      mensagem: { type: Sequelize.TEXT, allowNull: false },
      tipo: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "OBSERVACAO",
      },
      visualizado: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
    await queryInterface.dropTable("treinamento_feedbacks");
    await queryInterface.dropTable("treinamento_videos");
  },
};
