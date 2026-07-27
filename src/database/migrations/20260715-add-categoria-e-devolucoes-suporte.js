module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("suporte_movimentacoes", "categoria", {
      type: Sequelize.ENUM("VENDA", "TROCA", "COMPRA", "DEVOLUCAO"),
      allowNull: true,
    });

    await queryInterface.createTable("suporte_devolucoes_pendentes", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      itemId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "suporte_itens", key: "id" },
      },
      quantidade: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("PENDENTE", "CONCLUIDA"),
        allowNull: false,
        defaultValue: "PENDENTE",
      },
      movimentacaoOrigemId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "suporte_movimentacoes", key: "id" },
      },
      movimentacaoResolucaoId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "suporte_movimentacoes", key: "id" },
      },
      criadoPorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
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

    await queryInterface.addIndex("suporte_devolucoes_pendentes", ["itemId"]);
    await queryInterface.addIndex("suporte_devolucoes_pendentes", ["status"]);
    await queryInterface.addIndex("suporte_devolucoes_pendentes", [
      "movimentacaoOrigemId",
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("suporte_devolucoes_pendentes");
    await queryInterface.removeColumn("suporte_movimentacoes", "categoria");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_suporte_movimentacoes_categoria";',
    );
  },
};
