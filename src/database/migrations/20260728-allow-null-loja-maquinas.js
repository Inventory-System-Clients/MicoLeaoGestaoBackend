"use strict";

module.exports = {
  up: async (queryInterface) => {
    // queryInterface.changeColumn com "references" não emite o DROP NOT NULL
    // no Postgres (só recria a FK) — por isso o SQL direto.
    await queryInterface.sequelize.query(
      'ALTER TABLE "maquinas" ALTER COLUMN "lojaId" DROP NOT NULL;',
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "maquinas" ALTER COLUMN "lojaId" SET NOT NULL;',
    );
  },
};
