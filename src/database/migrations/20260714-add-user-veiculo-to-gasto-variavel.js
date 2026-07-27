// Migração de referência para o lançamento avulso de gastos variáveis
// (gasolina/estacionamento/outros). A aplicação real acontece nas
// checagens idempotentes em src/server.js -> startServer(), este arquivo
// documenta as mesmas mudanças de schema, seguindo o padrão do repositório.
export async function up(queryInterface) {
  const { DataTypes } = await import("sequelize");

  const colunas = await queryInterface.describeTable("GastoVariavel");
  if (!colunas.usuarioId) {
    await queryInterface.addColumn("GastoVariavel", "usuarioId", {
      type: DataTypes.UUID,
      allowNull: true,
    });
  }
  if (!colunas.veiculoId) {
    await queryInterface.addColumn("GastoVariavel", "veiculoId", {
      type: DataTypes.UUID,
      allowNull: true,
    });
  }

  await queryInterface.sequelize.query(`
    ALTER TYPE "enum_movimentacoes_veiculos_tipo" ADD VALUE IF NOT EXISTS 'abastecimento';
  `);
}

export async function down() {}
