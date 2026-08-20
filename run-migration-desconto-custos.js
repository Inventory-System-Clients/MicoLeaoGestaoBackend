import { DataTypes } from "sequelize";
import { sequelize } from "./src/database/connection.js";

const queryInterface = sequelize.getQueryInterface();

async function adicionarColunasCompras() {
  console.log("\n📝 Passo 1/2: colunas novas em 'compras' (número do pedido + desconto)...");
  const colunas = await queryInterface.describeTable("compras");

  if (!colunas.numero_pedido) {
    await queryInterface.addColumn("compras", "numero_pedido", {
      type: DataTypes.STRING(50),
      allowNull: true,
    });
    console.log("  ✅ coluna 'numero_pedido' adicionada");
  } else {
    console.log("  ⏭️  coluna 'numero_pedido' já existe");
  }

  if (!colunas.desconto_tipo) {
    await queryInterface.addColumn("compras", "desconto_tipo", {
      type: DataTypes.STRING(10),
      allowNull: true,
    });
    console.log("  ✅ coluna 'desconto_tipo' adicionada");
  } else {
    console.log("  ⏭️  coluna 'desconto_tipo' já existe");
  }

  if (!colunas.desconto_valor) {
    await queryInterface.addColumn("compras", "desconto_valor", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    });
    console.log("  ✅ coluna 'desconto_valor' adicionada");
  } else {
    console.log("  ⏭️  coluna 'desconto_valor' já existe");
  }
}

async function adicionarColunasCustosAdicionais() {
  console.log("\n📝 Passo 2/2: colunas novas em 'compra_custos_adicionais' (tipo/base/moeda)...");
  const colunas = await queryInterface.describeTable("compra_custos_adicionais");

  if (!colunas.tipo_valor) {
    await queryInterface.addColumn("compra_custos_adicionais", "tipo_valor", {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "FIXO",
    });
    console.log("  ✅ coluna 'tipo_valor' adicionada");
  } else {
    console.log("  ⏭️  coluna 'tipo_valor' já existe");
  }

  if (!colunas.base_calculo) {
    await queryInterface.addColumn("compra_custos_adicionais", "base_calculo", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
    console.log("  ✅ coluna 'base_calculo' adicionada");
  } else {
    console.log("  ⏭️  coluna 'base_calculo' já existe");
  }

  if (!colunas.moeda) {
    await queryInterface.addColumn("compra_custos_adicionais", "moeda", {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "BRL",
    });
    console.log("  ✅ coluna 'moeda' adicionada");
  } else {
    console.log("  ⏭️  coluna 'moeda' já existe");
  }
}

async function conferirResultado() {
  console.log("\n📝 Conferindo schema final...");
  const [colunasCompras] = await sequelize.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'compras' AND column_name IN ('numero_pedido', 'desconto_tipo', 'desconto_valor')
    ORDER BY ordinal_position
  `);
  console.table(colunasCompras);

  const [colunasCustos] = await sequelize.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'compra_custos_adicionais' AND column_name IN ('tipo_valor', 'base_calculo', 'moeda')
    ORDER BY ordinal_position
  `);
  console.table(colunasCustos);
}

async function runMigration() {
  try {
    console.log("🔄 Conectando ao banco de dados...");
    await sequelize.authenticate();
    console.log("✅ Conexão estabelecida com sucesso!");

    await adicionarColunasCompras();
    await adicionarColunasCustosAdicionais();
    await conferirResultado();

    console.log("\n✅ Migration de desconto/custos adicionais concluída com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar migration:", error);
    process.exit(1);
  }
}

runMigration();
