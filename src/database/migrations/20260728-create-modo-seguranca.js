"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("modo_seguranca", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        defaultValue: 1,
      },
      ativo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      motivo: { type: Sequelize.TEXT, allowNull: true },
      ativado_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      ativado_em: { type: Sequelize.DATE, allowNull: true },
      desativado_por_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      desativado_em: { type: Sequelize.DATE, allowNull: true },
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

    await queryInterface.bulkInsert("modo_seguranca", [
      {
        id: 1,
        ativo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("modo_seguranca");
  },
};
