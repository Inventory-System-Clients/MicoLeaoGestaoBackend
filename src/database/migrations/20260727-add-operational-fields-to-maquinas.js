"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("maquinas");

    if (!table.status_operacao) {
      await queryInterface.addColumn("maquinas", "status_operacao", {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "EM_OPERACAO",
      });
    }

  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("maquinas");

    if (table.status_operacao) {
      await queryInterface.removeColumn("maquinas", "status_operacao");
    }
  },
};
