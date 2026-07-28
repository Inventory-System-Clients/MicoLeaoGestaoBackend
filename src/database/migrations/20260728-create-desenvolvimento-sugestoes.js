"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("desenvolvimento_sugestoes", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      titulo: { type: Sequelize.STRING(180), allowNull: false },
      descricao: { type: Sequelize.TEXT, allowNull: false },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "PENDENTE",
      },
      resposta: { type: Sequelize.TEXT, allowNull: true },
      motivo_revisao: { type: Sequelize.TEXT, allowNull: true },
      criado_por_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      respondido_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      desenvolvido_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      baixado_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      baixado_em: { type: Sequelize.DATE, allowNull: true },
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
    await queryInterface.dropTable("desenvolvimento_sugestoes");
  },
};
