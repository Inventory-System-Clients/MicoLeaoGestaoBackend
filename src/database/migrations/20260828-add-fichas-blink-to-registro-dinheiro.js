"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("registro_dinheiro", "quantidadeFichasBlink", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("registro_dinheiro", "quantidadeFichasSistema", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("registro_dinheiro", "diferencaFichasBlink", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("registro_dinheiro", "alertaFichasBlinkResolvidoEm", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("registro_dinheiro", "alertaFichasBlinkResolvidoPorId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("registro_dinheiro", "alertaFichasBlinkResolvidoPorId");
    await queryInterface.removeColumn("registro_dinheiro", "alertaFichasBlinkResolvidoEm");
    await queryInterface.removeColumn("registro_dinheiro", "diferencaFichasBlink");
    await queryInterface.removeColumn("registro_dinheiro", "quantidadeFichasSistema");
    await queryInterface.removeColumn("registro_dinheiro", "quantidadeFichasBlink");
  },
};
