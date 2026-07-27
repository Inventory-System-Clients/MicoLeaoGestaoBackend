"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("lojas");

    if (!table.status_operacao) {
      await queryInterface.addColumn("lojas", "status_operacao", {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "ATIVA",
      });
    }

    if (!table.data_inicio) {
      await queryInterface.addColumn("lojas", "data_inicio", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.observacoes) {
      await queryInterface.addColumn("lojas", "observacoes", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!table.data_vencimento_extintor) {
      await queryInterface.addColumn("lojas", "data_vencimento_extintor", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("lojas");

    if (table.data_vencimento_extintor) {
      await queryInterface.removeColumn("lojas", "data_vencimento_extintor");
    }

    if (table.observacoes) {
      await queryInterface.removeColumn("lojas", "observacoes");
    }

    if (table.data_inicio) {
      await queryInterface.removeColumn("lojas", "data_inicio");
    }

    if (table.status_operacao) {
      await queryInterface.removeColumn("lojas", "status_operacao");
    }
  },
};
