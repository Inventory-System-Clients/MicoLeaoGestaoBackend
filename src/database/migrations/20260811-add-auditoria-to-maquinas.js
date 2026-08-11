"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("maquinas");

    if (!table.auditoria) {
      await queryInterface.addColumn("maquinas", "auditoria", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("maquinas");

    if (table.auditoria) {
      await queryInterface.removeColumn("maquinas", "auditoria");
    }
  },
};
