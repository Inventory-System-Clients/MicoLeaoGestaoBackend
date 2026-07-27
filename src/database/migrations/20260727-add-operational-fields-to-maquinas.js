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

    if (!table.media_saida_esperada) {
      await queryInterface.addColumn("maquinas", "media_saida_esperada", {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("maquinas");

    if (table.media_saida_esperada) {
      await queryInterface.removeColumn("maquinas", "media_saida_esperada");
    }

    if (table.status_operacao) {
      await queryInterface.removeColumn("maquinas", "status_operacao");
    }
  },
};
