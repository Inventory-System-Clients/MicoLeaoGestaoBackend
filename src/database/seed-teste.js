// Dados de exemplo para o banco de TESTE local (npm run seed:teste).
// Idempotente: só cria o que ainda não existe. Recusa rodar fora do localhost
// pra nunca encostar no banco do Render.
import { sequelize } from "./connection.js";
import { Loja, Maquina } from "../models/index.js";

if (process.env.DATABASE_URL || !["localhost", "127.0.0.1"].includes(process.env.DB_HOST)) {
  console.error("❌ seed-teste só roda no banco local (use npm run seed:teste).");
  process.exit(1);
}

const LOJAS = [
  { nome: "Depósito Principal", cidade: "São Paulo", estado: "SP" },
  { nome: "Shopping Centro", cidade: "São Paulo", estado: "SP" },
  { nome: "Shopping Norte", cidade: "Guarulhos", estado: "SP" },
  // Loja "em implantação" cadastrada à mão (jeito antigo): tem que continuar aparecendo
  {
    nome: "Loja Antiga Em Implantação",
    cidade: "Campinas",
    estado: "SP",
    statusOperacao: "EM_IMPLANTACAO",
  },
];

const MAQUINAS = [
  { codigo: "M01", nome: "Agarra Mais 01", tipo: "Agarra Mais", loja: "Shopping Centro" },
  { codigo: "M02", nome: "Agarra Mais 02", tipo: "Agarra Mais", loja: "Shopping Centro" },
  { codigo: "M03", nome: "Agarra Mais 03", tipo: "Agarra Mais", loja: "Shopping Norte" },
  { codigo: "M04", nome: "Agarra Mais 04", tipo: "Agarra Mais", loja: null },
  { codigo: "M05", nome: "Agarra Mais 05", tipo: "Agarra Mais", loja: null },
  { codigo: "TK01", nome: "TakeBall 01", tipo: "TakeBall", loja: null },
  { codigo: "TK02", nome: "TakeBall 02", tipo: "TakeBall", loja: null },
];

const seed = async () => {
  await sequelize.authenticate();
  await sequelize.sync();

  const lojasPorNome = {};
  for (const dados of LOJAS) {
    const [loja, criada] = await Loja.findOrCreate({
      where: { nome: dados.nome },
      defaults: {
        endereco: "Rua de Teste, 100",
        telefone: "(11) 90000-0000",
        responsavel: "Responsável Teste",
        statusOperacao: "ATIVA",
        ativo: true,
        ...dados,
      },
    });
    lojasPorNome[loja.nome] = loja;
    console.log(`${criada ? "✅ criada" : "ℹ️  já existia"}: loja ${loja.nome}`);
  }

  for (const dados of MAQUINAS) {
    const lojaId = dados.loja ? lojasPorNome[dados.loja].id : null;
    const [maquina, criada] = await Maquina.findOrCreate({
      where: { codigo: dados.codigo },
      defaults: {
        nome: dados.nome,
        tipo: dados.tipo,
        lojaId,
        statusOperacao: lojaId ? "EM_OPERACAO" : "PARADA",
        motivoParada: lojaId ? null : "No depósito",
        custoAquisicao: dados.tipo === "TakeBall" ? 18000 : 12000,
      },
    });
    console.log(
      `${criada ? "✅ criada" : "ℹ️  já existia"}: máquina ${maquina.codigo} (${dados.loja || "Depósito"})`,
    );
  }

  console.log("\n🎉 Banco de teste pronto.");
  process.exit(0);
};

seed().catch((error) => {
  console.error("❌ Erro no seed de teste:", error);
  process.exit(1);
});
