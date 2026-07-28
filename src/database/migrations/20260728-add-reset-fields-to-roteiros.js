"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const roteiros = await queryInterface.describeTable("roteiros");

    if (!roteiros.dia_semana_reset) {
      await queryInterface.addColumn("roteiros", "dia_semana_reset", {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    if (!roteiros.hora_reset) {
      await queryInterface.addColumn("roteiros", "hora_reset", {
        type: Sequelize.STRING(5),
        allowNull: false,
        defaultValue: "23:59",
      });
    }

    if (!roteiros.ultimo_reset_em) {
      await queryInterface.addColumn("roteiros", "ultimo_reset_em", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    const roteiros = await queryInterface.describeTable("roteiros");

    if (roteiros.ultimo_reset_em) {
      await queryInterface.removeColumn("roteiros", "ultimo_reset_em");
    }
    if (roteiros.hora_reset) {
      await queryInterface.removeColumn("roteiros", "hora_reset");
    }
    if (roteiros.dia_semana_reset) {
      await queryInterface.removeColumn("roteiros", "dia_semana_reset");
    }
  },
};
