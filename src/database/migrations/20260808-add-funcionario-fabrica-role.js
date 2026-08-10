"use strict";

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_usuarios_role" ADD VALUE IF NOT EXISTS 'FUNCIONARIO_FABRICA';
    `);
  },

  down: async () => {},
};
