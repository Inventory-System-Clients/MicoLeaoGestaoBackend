module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("alertas_movimentacao", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      maquinaId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "maquinas", key: "id" },
      },
      lojaId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "lojas", key: "id" },
      },
      usuarioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
      },
      observacao: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("PENDENTE", "RESOLVIDO"),
        allowNull: false,
        defaultValue: "PENDENTE",
      },
      resolvidoPorId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
      },
      resolvidoEm: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable("alertas_movimentacao");
  },
};
