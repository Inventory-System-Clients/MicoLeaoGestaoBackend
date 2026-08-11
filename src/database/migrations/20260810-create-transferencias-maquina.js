"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tabelas = await queryInterface.showAllTables();

    if (!tabelas.includes("transferencias_maquina")) {
      await queryInterface.createTable("transferencias_maquina", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        maquinaId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "maquinas", key: "id" },
        },
        lojaOrigemId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "lojas", key: "id" },
        },
        lojaDestinoId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "lojas", key: "id" },
        },
        dataTransferencia: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        usuarioId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "usuarios", key: "id" },
        },
        observacao: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
    }
  },

  down: async (queryInterface) => {
    const tabelas = await queryInterface.showAllTables();

    if (tabelas.includes("transferencias_maquina")) {
      await queryInterface.dropTable("transferencias_maquina");
    }
  },
};
