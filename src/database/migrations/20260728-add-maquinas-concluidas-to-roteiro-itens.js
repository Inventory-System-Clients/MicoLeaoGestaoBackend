"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const itens = await queryInterface.describeTable("roteiro_itens");

    if (!itens.maquinas_concluidas) {
      await queryInterface.addColumn("roteiro_itens", "maquinas_concluidas", {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      });
    }
  },

  down: async (queryInterface) => {
    const itens = await queryInterface.describeTable("roteiro_itens");

    if (itens.maquinas_concluidas) {
      await queryInterface.removeColumn("roteiro_itens", "maquinas_concluidas");
    }
  },
};
