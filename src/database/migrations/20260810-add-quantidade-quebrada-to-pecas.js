"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("pecas");

    if (!table.quantidadeQuebrada) {
      await queryInterface.addColumn("pecas", "quantidadeQuebrada", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("pecas");

    if (table.quantidadeQuebrada) {
      await queryInterface.removeColumn("pecas", "quantidadeQuebrada");
    }
  },
};
