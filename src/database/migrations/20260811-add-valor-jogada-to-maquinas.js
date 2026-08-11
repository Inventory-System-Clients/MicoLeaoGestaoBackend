"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("maquinas");

    if (!table.valor_jogada) {
      await queryInterface.addColumn("maquinas", "valor_jogada", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("maquinas");

    if (table.valor_jogada) {
      await queryInterface.removeColumn("maquinas", "valor_jogada");
    }
  },
};
