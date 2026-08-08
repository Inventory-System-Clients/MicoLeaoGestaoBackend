"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("GastoFixoLoja");

    if (!table.vigencia_inicio) {
      await queryInterface.addColumn("GastoFixoLoja", "vigencia_inicio", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.vigencia_fim) {
      await queryInterface.addColumn("GastoFixoLoja", "vigencia_fim", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("GastoFixoLoja");

    if (table.vigencia_fim) {
      await queryInterface.removeColumn("GastoFixoLoja", "vigencia_fim");
    }

    if (table.vigencia_inicio) {
      await queryInterface.removeColumn("GastoFixoLoja", "vigencia_inicio");
    }
  },
};
