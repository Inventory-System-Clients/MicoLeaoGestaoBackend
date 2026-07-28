"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("fornecedores", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      nome: { type: Sequelize.STRING(160), allowNull: false },
      contato: { type: Sequelize.STRING(120), allowNull: true },
      telefone_whatsapp: { type: Sequelize.STRING(40), allowNull: true },
      cidade: { type: Sequelize.STRING(120), allowNull: true },
      observacoes: { type: Sequelize.TEXT, allowNull: true },
      ativo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
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

    await queryInterface.createTable("fornecedor_produtos", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      fornecedor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "fornecedores", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      produto_nome: { type: Sequelize.STRING(160), allowNull: false },
      quantidade: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      unidade: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "un",
      },
      preco: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      observacoes: { type: Sequelize.TEXT, allowNull: true },
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

    await queryInterface.createTable("fornecedor_anexos", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      fornecedor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "fornecedores", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      titulo: { type: Sequelize.STRING(140), allowNull: true },
      url: { type: Sequelize.STRING(700), allowNull: false },
      tipo: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "ORCAMENTO",
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
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("fornecedor_anexos");
    await queryInterface.dropTable("fornecedor_produtos");
    await queryInterface.dropTable("fornecedores");
  },
};
