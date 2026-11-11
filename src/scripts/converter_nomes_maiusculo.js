// Converte os nomes antigos de produtos, insumos e peças para o padrão novo
// (MAIÚSCULO, sem espaços nas pontas e sem espaços duplicados — utils/nomeCadastro.js).
//
// Por padrão só SIMULA: mostra quantos e quais nomes mudariam, sem gravar nada.
// Para gravar, passe --aplicar. Tudo roda numa transação só.
//
//   node --env-file=.env.teste src/scripts/converter_nomes_maiusculo.js            (simula no teste)
//   node --env-file=.env.teste src/scripts/converter_nomes_maiusculo.js --aplicar  (grava no teste)
//   node src/scripts/converter_nomes_maiusculo.js                                   (simula em PRODUÇÃO via .env)
//
// Duplicados antigos não são juntados: continuam existindo, só que em maiúsculo.
import { sequelize } from "../database/connection.js";
import { chaveNome, normalizarNome } from "../utils/nomeCadastro.js";

sequelize.options.logging = false;

const APLICAR = process.argv.includes("--aplicar");
const TABELAS = [
  { tabela: "produtos", rotulo: "Produtos" },
  { tabela: "insumos", rotulo: "Insumos" },
  { tabela: "pecas", rotulo: "Peças" },
];
const TAMANHO_MAXIMO = 100;

const destino = process.env.DATABASE_URL
  ? `DATABASE_URL (${new URL(process.env.DATABASE_URL).host})`
  : `${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`;

console.log(`Banco: ${destino}`);
console.log(APLICAR ? "Modo: APLICAR (vai gravar)\n" : "Modo: simulação (nada é gravado)\n");

const transaction = await sequelize.transaction();
try {
  let totalGeral = 0;

  for (const { tabela, rotulo } of TABELAS) {
    const [linhas] = await sequelize.query(
      `SELECT id, nome, ativo FROM ${tabela} ORDER BY nome`,
      { transaction },
    );

    const mudancas = linhas
      .map((l) => ({ ...l, novo: normalizarNome(l.nome) }))
      .filter((l) => l.novo !== l.nome);
    const longos = mudancas.filter((l) => l.novo.length > TAMANHO_MAXIMO);
    const aplicaveis = mudancas.filter((l) => l.novo.length <= TAMANHO_MAXIMO);

    // Só informativo: grupos de nomes que já são "iguais" pela regra nova
    const grupos = new Map();
    for (const l of linhas) {
      const chave = chaveNome(l.nome);
      grupos.set(chave, [...(grupos.get(chave) || []), l]);
    }
    const duplicados = [...grupos.values()].filter((g) => g.length > 1);

    console.log(`== ${rotulo}: ${linhas.length} cadastrados, ${aplicaveis.length} mudam de nome ==`);
    for (const l of aplicaveis) {
      console.log(`  "${l.nome}" -> "${l.novo}"${l.ativo ? "" : " (inativo)"}`);
    }
    for (const l of longos) {
      console.log(`  PULADO (passaria de ${TAMANHO_MAXIMO} caracteres): "${l.nome}"`);
    }
    if (duplicados.length) {
      console.log(`  Duplicados já existentes (ficam como estão): ${duplicados.length} grupo(s)`);
      for (const g of duplicados) {
        console.log(`    ${g.map((l) => `"${l.nome}"${l.ativo ? "" : " (inativo)"}`).join(" | ")}`);
      }
    }
    console.log("");

    // Um UPDATE por tabela (menos idas e voltas ao banco remoto)
    if (APLICAR && aplicaveis.length) {
      const valores = aplicaveis.map((_, i) => `(:id${i}::uuid, :nome${i})`).join(", ");
      const replacements = Object.fromEntries(
        aplicaveis.flatMap((l, i) => [[`id${i}`, l.id], [`nome${i}`, l.novo]]),
      );
      await sequelize.query(
        `UPDATE ${tabela} AS t SET nome = v.nome FROM (VALUES ${valores}) AS v(id, nome) WHERE t.id = v.id`,
        { replacements, transaction },
      );
    }
    totalGeral += aplicaveis.length;
  }

  if (APLICAR) {
    await transaction.commit();
    console.log(`Gravado: ${totalGeral} nome(s) convertido(s).`);
  } else {
    await transaction.rollback();
    console.log(`Total que mudaria: ${totalGeral}. Nada foi gravado. Rode com --aplicar para gravar.`);
  }
} catch (error) {
  console.error("Erro, nada foi gravado:", error.original?.message || error.message);
  // Se a conexão caiu, o rollback também falha; o banco descarta a transação sozinho
  await transaction.rollback().catch(() => {});
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
