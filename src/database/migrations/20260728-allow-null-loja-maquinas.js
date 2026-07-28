"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("maquinas", "lojaId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "lojas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("maquinas", "lojaId", {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "lojas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },
};
