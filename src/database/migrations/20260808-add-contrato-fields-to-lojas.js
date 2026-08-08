"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("lojas");

    if (!table.data_fim_contrato) {
      await queryInterface.addColumn("lojas", "data_fim_contrato", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.dias_aviso_contrato) {
      await queryInterface.addColumn("lojas", "dias_aviso_contrato", {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 60,
      });
    }

    if (!table.contrato_aviso_adiado_dias) {
      await queryInterface.addColumn("lojas", "contrato_aviso_adiado_dias", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("lojas");

    if (table.contrato_aviso_adiado_dias) {
      await queryInterface.removeColumn("lojas", "contrato_aviso_adiado_dias");
    }

    if (table.dias_aviso_contrato) {
      await queryInterface.removeColumn("lojas", "dias_aviso_contrato");
    }

    if (table.data_fim_contrato) {
      await queryInterface.removeColumn("lojas", "data_fim_contrato");
    }
  },
};
