module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("suporte_itens", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      nome: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      tipo: {
        type: Sequelize.ENUM("PECA", "PRODUTO"),
        allowNull: false,
        defaultValue: "PECA",
      },
      codigo: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      descricao: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      quantidade: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      estoqueMinimo: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      ativo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.createTable("suporte_movimentacoes", {
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
      tipo: {
        type: Sequelize.ENUM("ENTRADA", "SAIDA"),
        allowNull: false,
      },
      quantidade: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      motivo: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      quantidadeAnterior: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      quantidadeAtual: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      usuarioId: {
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

    await queryInterface.addIndex("suporte_itens", ["ativo"]);
    await queryInterface.addIndex("suporte_movimentacoes", ["itemId"]);
    await queryInterface.addIndex("suporte_movimentacoes", ["usuarioId"]);
    await queryInterface.addIndex("suporte_movimentacoes", ["createdAt"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("suporte_movimentacoes");
    await queryInterface.dropTable("suporte_itens");
  },
};
