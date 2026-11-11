// Confere o catálogo de acessos contra as rotas reais da API.
// Uso: npm run verificar:permissoes   (não conecta no banco)
//
// 1. Toda rota autenticada está em exatamente uma ação (e toda rota do
//    catálogo existe).
// 2. As rotas de uma mesma ação têm hoje os mesmos perfis com acesso.
// 3. Ação só de tela tem `perfisPadrao`.
// 4. Sem ajustes, perfis antigos seguem exatamente as regras de antes
//    (a checagem central nunca bloqueia nem libera nada para eles).
// 5. Perfis novos sem ajustes são barrados em todas as rotas, menos o perfil.
import { listarRotasDaApi } from "../src/permissoes/rotasDaApi.js";
import { ACOES } from "../src/permissoes/catalogo.js";
import {
  PERFIS_LEGADOS,
  PADRAO_PERFIS_RESTRITOS,
  ROTAS_SEMPRE_LIBERADAS,
  decidirAcesso,
  encontrarRota,
} from "../src/permissoes/acessos.js";

const problemas = [];
const rotulo = (r) => `${r.metodo} ${r.caminho}`;

// Mesma rota registrada duas vezes (ex.: /api/graficos) conta uma vez só
const rotas = [...new Map(listarRotasDaApi().map((r) => [rotulo(r), r])).values()];
const autenticadas = rotas.filter((r) => r.autenticada);
const rolesDe = new Map(rotas.map((r) => [rotulo(r), r.roles]));

// 1. Cobertura
const donoDaRota = new Map();
for (const acao of ACOES) {
  for (const rota of acao.rotas || []) {
    if (!rolesDe.has(rota)) problemas.push(`[${acao.chave}] rota não existe na API: ${rota}`);
    if (donoDaRota.has(rota)) {
      problemas.push(`Rota em duas ações (${donoDaRota.get(rota)} e ${acao.chave}): ${rota}`);
    }
    donoDaRota.set(rota, acao.chave);
  }
}
for (const rota of autenticadas) {
  const chave = rotulo(rota);
  if (!donoDaRota.has(chave) && !ROTAS_SEMPRE_LIBERADAS.includes(chave)) {
    problemas.push(`Rota fora do catálogo: ${chave}`);
  }
  // A busca da requisição tem que achar a própria rota (não outra parecida)
  const exemplo = rota.caminho.replace(/:[^/]+/g, "x1");
  const achada = encontrarRota(rota.metodo, exemplo);
  const esperada = donoDaRota.get(chave) ?? null;
  if (esperada && achada?.chave !== esperada) {
    problemas.push(`${chave} cai na ação errada (${achada?.chave}) ao buscar ${exemplo}`);
  }
}

// 2. Perfis iguais dentro da ação
const texto = (roles) => (roles === null ? "todos" : [...roles].sort().join(","));
for (const acao of ACOES) {
  const conjuntos = new Set((acao.rotas || []).map((rota) => texto(rolesDe.get(rota) ?? [])));
  if (conjuntos.size > 1) {
    problemas.push(`[${acao.chave}] rotas com perfis diferentes: ${[...conjuntos].join(" | ")}`);
  }
  // 3. Ação só de tela
  if (!acao.rotas?.length && !acao.perfisPadrao && !acao.somenteAdmin) {
    problemas.push(`[${acao.chave}] ação só de tela sem perfisPadrao`);
  }
  for (const req of acao.requer || []) {
    if (!ACOES.some((a) => a.chave === req)) problemas.push(`[${acao.chave}] requer ação inexistente: ${req}`);
  }
}

// 4 e 5. Simulação sem ajustes
for (const rota of autenticadas) {
  const exemplo = rota.caminho.replace(/:[^/]+/g, "x1");
  for (const role of PERFIS_LEGADOS) {
    const decisao = decidirAcesso({ role, acessosPersonalizados: {} }, rota.metodo, exemplo);
    if (decisao !== "SEGUIR") {
      problemas.push(`${role} sem ajuste teria ${decisao} em ${rotulo(rota)} (deveria seguir a regra atual)`);
    }
  }
  for (const role of Object.keys(PADRAO_PERFIS_RESTRITOS)) {
    const decisao = decidirAcesso({ role, acessosPersonalizados: {} }, rota.metodo, exemplo);
    const sempre = ROTAS_SEMPRE_LIBERADAS.includes(rotulo(rota));
    const chave = donoDaRota.get(rotulo(rota));
    const esperado = sempre
      ? "SEGUIR"
      : PADRAO_PERFIS_RESTRITOS[role].includes(chave)
        ? "LIBERAR"
        : "NEGAR";
    if (decisao !== esperado) {
      problemas.push(`${role} teria ${decisao} em ${rotulo(rota)} (esperado ${esperado})`);
    }
  }
}

console.log(`Rotas da API: ${rotas.length} (${autenticadas.length} autenticadas)`);
console.log(`Ações no catálogo: ${ACOES.length}`);
if (problemas.length) {
  console.log(`\n❌ ${problemas.length} problema(s):`);
  for (const problema of problemas) console.log(` - ${problema}`);
  process.exit(1);
}
console.log(
  "\n✅ Catálogo confere: sem ajuste, perfis antigos seguem as mesmas regras de rota de antes (limites padrão à parte: ver LIMITES_PADRAO).",
);
process.exit(0);
