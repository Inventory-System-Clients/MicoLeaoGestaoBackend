"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("maquinas");

    if (!table.motivo_parada) {
      await queryInterface.addColumn("maquinas", "motivo_parada", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("maquinas");

    if (table.motivo_parada) {
      await queryInterface.removeColumn("maquinas", "motivo_parada");
    }
  },
};
