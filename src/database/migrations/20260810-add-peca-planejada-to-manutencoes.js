"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable("manutencoes");

    if (!table.pecaPlanejadaId) {
      await queryInterface.addColumn("manutencoes", "pecaPlanejadaId", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!table.pecaPlanejadaFuncionarioId) {
      await queryInterface.addColumn(
        "manutencoes",
        "pecaPlanejadaFuncionarioId",
        {
          type: Sequelize.UUID,
          allowNull: true,
        },
      );
    }

    if (!table.pecaPlanejadaQuantidade) {
      await queryInterface.addColumn(
        "manutencoes",
        "pecaPlanejadaQuantidade",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
      );
    }

    if (!table.pecaPlanejadaObservacao) {
      await queryInterface.addColumn(
        "manutencoes",
        "pecaPlanejadaObservacao",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      );
    }

    if (!table.pecaPlanejadaConsumida) {
      await queryInterface.addColumn(
        "manutencoes",
        "pecaPlanejadaConsumida",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      );
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable("manutencoes");

    if (table.pecaPlanejadaConsumida) {
      await queryInterface.removeColumn(
        "manutencoes",
        "pecaPlanejadaConsumida",
      );
    }
    if (table.pecaPlanejadaObservacao) {
      await queryInterface.removeColumn(
        "manutencoes",
        "pecaPlanejadaObservacao",
      );
    }
    if (table.pecaPlanejadaQuantidade) {
      await queryInterface.removeColumn(
        "manutencoes",
        "pecaPlanejadaQuantidade",
      );
    }
    if (table.pecaPlanejadaFuncionarioId) {
      await queryInterface.removeColumn(
        "manutencoes",
        "pecaPlanejadaFuncionarioId",
      );
    }
    if (table.pecaPlanejadaId) {
      await queryInterface.removeColumn("manutencoes", "pecaPlanejadaId");
    }
  },
};
