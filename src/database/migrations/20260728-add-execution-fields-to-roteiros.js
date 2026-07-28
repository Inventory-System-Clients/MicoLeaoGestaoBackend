"use strict";

const normalizarNomeTabelas = (tables) =>
  tables.map((table) =>
    typeof table === "string"
      ? table
      : table.tableName || table.table_name || table.name,
  );

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const itens = await queryInterface.describeTable("roteiro_itens");

    if (!itens.concluido) {
      await queryInterface.addColumn("roteiro_itens", "concluido", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!itens.concluido_em) {
      await queryInterface.addColumn("roteiro_itens", "concluido_em", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!itens.maquinas_concluidas) {
      await queryInterface.addColumn("roteiro_itens", "maquinas_concluidas", {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      });
    }

    const tables = normalizarNomeTabelas(await queryInterface.showAllTables());
    if (!tables.includes("roteiro_configuracoes")) {
      await queryInterface.createTable("roteiro_configuracoes", {
        id: {
          type: Sequelize.STRING(40),
          primaryKey: true,
          allowNull: false,
          defaultValue: "global",
        },
        dia_semana_reset: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        hora_reset: {
          type: Sequelize.STRING(5),
          allowNull: false,
          defaultValue: "23:59",
        },
        ultimo_reset_em: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }
  },

  down: async (queryInterface) => {
    const tables = normalizarNomeTabelas(await queryInterface.showAllTables());
    if (tables.includes("roteiro_configuracoes")) {
      await queryInterface.dropTable("roteiro_configuracoes");
    }

    const itens = await queryInterface.describeTable("roteiro_itens");
    if (itens.maquinas_concluidas) {
      await queryInterface.removeColumn("roteiro_itens", "maquinas_concluidas");
    }
    if (itens.concluido_em) {
      await queryInterface.removeColumn("roteiro_itens", "concluido_em");
    }
    if (itens.concluido) {
      await queryInterface.removeColumn("roteiro_itens", "concluido");
    }
  },
};
