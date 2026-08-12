import { randomUUID } from "node:crypto";
import { DataTypes } from "sequelize";
import { sequelize } from "./src/database/connection.js";

const queryInterface = sequelize.getQueryInterface();

const timestampColumns = () => ({
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

async function adicionarColunasCabecalho() {
  console.log("\n📝 Passo 1/4: colunas novas no cabeçalho de 'compras'...");
  const colunas = await queryInterface.describeTable("compras");

  if (!colunas.moeda) {
    await queryInterface.addColumn("compras", "moeda", {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL",
    });
    console.log("  ✅ coluna 'moeda' adicionada");
  } else {
    console.log("  ⏭️  coluna 'moeda' já existe");
  }

  if (!colunas.tipoPagamento) {
    await queryInterface.addColumn("compras", "tipoPagamento", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
    console.log("  ✅ coluna 'tipoPagamento' adicionada");
  } else {
    console.log("  ⏭️  coluna 'tipoPagamento' já existe");
  }

  if (!colunas.quantidadeParcelas) {
    await queryInterface.addColumn("compras", "quantidadeParcelas", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    console.log("  ✅ coluna 'quantidadeParcelas' adicionada");
  } else {
    console.log("  ⏭️  coluna 'quantidadeParcelas' já existe");
  }

  if (!colunas.formaPagamento) {
    await queryInterface.addColumn("compras", "formaPagamento", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
    console.log("  ✅ coluna 'formaPagamento' adicionada");
  } else {
    console.log("  ⏭️  coluna 'formaPagamento' já existe");
  }
}

async function criarTabelasNovas() {
  console.log("\n📝 Passo 2/4: tabelas novas (compra_itens, compra_custos_adicionais, contas_pagar)...");
  const tabelas = await queryInterface.showAllTables();

  if (!tabelas.includes("compra_itens")) {
    await queryInterface.createTable("compra_itens", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      compra_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "compras", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      tipo_item: { type: DataTypes.STRING(10), allowNull: false },
      produto_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "produtos", key: "id" },
      },
      insumo_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "insumos", key: "id" },
      },
      peca_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "pecas", key: "id" },
      },
      nome_item: { type: DataTypes.STRING(150), allowNull: false },
      sku: { type: DataTypes.STRING(60), allowNull: true },
      quantidade: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      unidade: { type: DataTypes.STRING(20), allowNull: true },
      valor_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      valor_total: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      loja_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "lojas", key: "id" },
      },
      descricao_uso: { type: DataTypes.TEXT, allowNull: true },
      ...timestampColumns(),
    });
    console.log("  ✅ tabela 'compra_itens' criada");
  } else {
    console.log("  ⏭️  tabela 'compra_itens' já existe");
  }

  if (!tabelas.includes("compra_custos_adicionais")) {
    await queryInterface.createTable("compra_custos_adicionais", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      compra_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "compras", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      descricao: { type: DataTypes.STRING(200), allowNull: false },
      valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      forma_pagamento: { type: DataTypes.STRING(20), allowNull: false },
      ...timestampColumns(),
    });
    console.log("  ✅ tabela 'compra_custos_adicionais' criada");
  } else {
    console.log("  ⏭️  tabela 'compra_custos_adicionais' já existe");
  }

  if (!tabelas.includes("contas_pagar")) {
    await queryInterface.createTable("contas_pagar", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      origem: { type: DataTypes.STRING(10), allowNull: false },
      compra_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "compras", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      fornecedor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "fornecedores", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      descricao: { type: DataTypes.STRING(200), allowNull: true },
      numero_parcela: { type: DataTypes.INTEGER, allowNull: true },
      total_parcelas: { type: DataTypes.INTEGER, allowNull: true },
      valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      moeda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "BRL" },
      cotacao_dolar: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
      valor_brl: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      vencimento: { type: DataTypes.DATEONLY, allowNull: false },
      forma_pagamento: { type: DataTypes.STRING(20), allowNull: false },
      status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "PENDENTE" },
      pago_em: { type: DataTypes.DATE, allowNull: true },
      pago_por_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      criado_por_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "usuarios", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      observacao: { type: DataTypes.TEXT, allowNull: true },
      ...timestampColumns(),
    });
    console.log("  ✅ tabela 'contas_pagar' criada");
  } else {
    console.log("  ⏭️  tabela 'contas_pagar' já existe");
  }
}

async function migrarDadosAntigos() {
  console.log("\n📝 Passo 3/4: migrando compras antigas (1 item) para 'compra_itens'...");
  const colunas = await queryInterface.describeTable("compras");
  const colunasAntigas = [
    "produtoId",
    "insumoId",
    "pecaId",
    "nomeItem",
    "descricaoUso",
    "quantidade",
    "unidade",
    "valorUnitario",
    "valorTotal",
    "lojaId",
  ];
  const temColunasAntigas = colunasAntigas.some((coluna) => colunas[coluna]);

  if (!temColunasAntigas) {
    console.log("  ⏭️  colunas antigas já não existem em 'compras' — nada para migrar");
    return;
  }

  const [comprasAntigas] = await sequelize.query(`
    SELECT id, "produtoId", "insumoId", "pecaId", "nomeItem", "descricaoUso",
           quantidade, unidade, "valorUnitario", "valorTotal", "lojaId",
           "createdAt", "updatedAt"
    FROM compras
  `);

  if (comprasAntigas.length > 0) {
    const [jaMigradas] = await sequelize.query(
      `SELECT DISTINCT compra_id FROM compra_itens WHERE compra_id = ANY($1)`,
      { bind: [comprasAntigas.map((c) => c.id)] },
    );
    const idsJaMigrados = new Set(jaMigradas.map((r) => r.compra_id));
    const pendentes = comprasAntigas.filter((c) => !idsJaMigrados.has(c.id));

    if (pendentes.length > 0) {
      const linhas = pendentes.map((c) => ({
        id: randomUUID(),
        compra_id: c.id,
        tipo_item: c.produtoId ? "PRODUTO" : c.insumoId ? "INSUMO" : c.pecaId ? "PECA" : "PRODUTO",
        produto_id: c.produtoId,
        insumo_id: c.insumoId,
        peca_id: c.pecaId,
        nome_item: c.nomeItem || "Item",
        sku: null,
        quantidade: c.quantidade,
        unidade: c.unidade,
        valor_unitario: c.valorUnitario,
        valor_total: c.valorTotal,
        loja_id: c.lojaId,
        descricao_uso: c.descricaoUso,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
      await queryInterface.bulkInsert("compra_itens", linhas);
      console.log(`  ✅ ${linhas.length} compra(s) antiga(s) copiada(s) para 'compra_itens'`);
    } else {
      console.log("  ⏭️  todas as compras antigas já tinham sido copiadas");
    }
  } else {
    console.log("  ⏭️  não há linhas em 'compras' para copiar");
  }

  console.log("  🗑️  removendo colunas antigas de 'compras'...");
  for (const coluna of colunasAntigas) {
    if (colunas[coluna]) {
      await queryInterface.removeColumn("compras", coluna);
      console.log(`    ✅ coluna '${coluna}' removida`);
    }
  }
}

async function conferirResultado() {
  console.log("\n📝 Passo 4/4: conferindo schema final...");
  const [colunasCompras] = await sequelize.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'compras' ORDER BY ordinal_position
  `);
  console.log("\n📋 Colunas de 'compras':");
  console.table(colunasCompras);

  const [totalItens] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM compra_itens`);
  const [totalContas] = await sequelize.query(`SELECT COUNT(*)::int AS total FROM contas_pagar`);
  console.log(`\n📊 compra_itens: ${totalItens[0].total} linha(s)`);
  console.log(`📊 contas_pagar: ${totalContas[0].total} linha(s)`);
}

async function runMigration() {
  try {
    console.log("🔄 Conectando ao banco de dados...");
    await sequelize.authenticate();
    console.log("✅ Conexão estabelecida com sucesso!");

    await adicionarColunasCabecalho();
    await criarTabelasNovas();
    await migrarDadosAntigos();
    await conferirResultado();

    console.log("\n✅ Migration do pedido de compra concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migration:", error);
    process.exit(1);
  }
}

runMigration();
