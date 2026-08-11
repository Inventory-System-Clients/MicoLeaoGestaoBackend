"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("maquinas");

    if (!table.geradora_receita) {
      await queryInterface.addColumn("maquinas", "geradora_receita", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!table.categoria_geradora) {
      await queryInterface.addColumn("maquinas", "categoria_geradora", {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    if (!table.telemetria) {
      await queryInterface.addColumn("maquinas", "telemetria", {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("maquinas");

    if (table.telemetria) {
      await queryInterface.removeColumn("maquinas", "telemetria");
    }
    if (table.categoria_geradora) {
      await queryInterface.removeColumn("maquinas", "categoria_geradora");
    }
    if (table.geradora_receita) {
      await queryInterface.removeColumn("maquinas", "geradora_receita");
    }
  },
};
