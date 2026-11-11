import { ACOES, ACOES_POR_CHAVE } from "./catalogo.js";

// Acesso total, sem lista
export const PERFIS_ACESSO_TOTAL = ["ADMIN", "DESENVOLVEDOR"];

// Perfis que já existiam: o padrão é o comportamento atual do sistema (as
// regras de perfil de cada rota). A checagem central só age quando o usuário
// tem ajuste: ação tirada -> bloqueia; ação dada a mais -> libera.
export const PERFIS_LEGADOS = ["FUNCIONARIO", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"];

// Perfis que começam sem nada: só usam o que está na lista (padrão + ajustes).
// Para mudar o padrão de um desses perfis, edite a lista aqui.
export const PADRAO_PERFIS_RESTRITOS = {
  CONSULTOR_VENDAS: [],
  MOTORISTA: [],
  ABASTECEDOR: [],
};

// Limites que já vêm para todos, menos Admin e Desenvolvedor. No usuário dá
// pra trocar por outro limite ou tirar (ajustes.limites[chave] = {}).
const LIMITE_EXCLUIR_SOMENTE_PROPRIAS_NO_DIA = {
  somenteProprias: true,
  somenteMesmoDia: true,
};
export const LIMITES_PADRAO = {
  "sangrias.excluir": LIMITE_EXCLUIR_SOMENTE_PROPRIAS_NO_DIA,
  "sangrias.excluirEmLote": LIMITE_EXCLUIR_SOMENTE_PROPRIAS_NO_DIA,
};

// Sempre liberado pra quem está logado: ver e editar o próprio perfil
export const ROTAS_SEMPRE_LIBERADAS = ["GET /api/auth/perfil", "PUT /api/auth/perfil"];

export const ehPerfilAcessoTotal = (role) => PERFIS_ACESSO_TOTAL.includes(role);
export const ehPerfilRestrito = (role) =>
  Object.prototype.hasOwnProperty.call(PADRAO_PERFIS_RESTRITOS, role);

// "GET /api/lojas/:id" -> { metodo, regex, parametros }
const compilarRota = (rota) => {
  const [metodo, caminho] = rota.split(" ");
  const partes = caminho.split("/");
  const regex = new RegExp(
    `^${partes.map((parte) => (parte.startsWith(":") ? "[^/]+" : parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}$`,
  );
  return { metodo, regex, parametros: partes.filter((p) => p.startsWith(":")).length };
};

const ROTAS_COMPILADAS = [
  ...ROTAS_SEMPRE_LIBERADAS.map((rota) => ({ ...compilarRota(rota), chave: null, sempre: true })),
  ...ACOES.flatMap((acao) =>
    (acao.rotas || []).map((rota) => ({ ...compilarRota(rota), chave: acao.chave })),
  ),
];

// Ação da requisição; rota estática ganha de rota com parâmetro
// (ex.: /api/produtos/categorias antes de /api/produtos/:id)
export const encontrarRota = (metodo, url) => {
  const caminho = String(url || "").split("?")[0].replace(/\/+$/, "") || "/";
  const candidatas = ROTAS_COMPILADAS.filter(
    (rota) => rota.metodo === String(metodo).toUpperCase() && rota.regex.test(caminho),
  );
  if (candidatas.length === 0) return null;
  return candidatas.reduce((melhor, rota) => (rota.parametros < melhor.parametros ? rota : melhor));
};

const listaDeChaves = (valor) =>
  Array.isArray(valor) ? [...new Set(valor.filter((chave) => ACOES_POR_CHAVE.has(chave)))] : [];

// Limites por ação: { "sangrias.ver": { dias: 3, somenteProprias: true } }.
// Só ficam os limites que a ação declara no catálogo, com valor válido.
const limparLimites = (limites) => {
  if (!limites || typeof limites !== "object") return {};
  const saida = {};
  for (const [chave, valores] of Object.entries(limites)) {
    const definicoes = ACOES_POR_CHAVE.get(chave)?.limites || [];
    const limpo = {};
    for (const definicao of definicoes) {
      const valor = valores?.[definicao.chave];
      if (definicao.tipo === "dias") {
        const dias = parseInt(valor, 10);
        if (Number.isInteger(dias) && dias >= 1 && dias <= 3650) limpo[definicao.chave] = dias;
      } else if (definicao.tipo === "sim" && valor === true) {
        limpo[definicao.chave] = true;
      }
    }
    // Objeto vazio também fica: quer dizer "este usuário não tem limite"
    // (tira o limite padrão do perfil para ele)
    if (definicoes.length > 0) saida[chave] = limpo;
  }
  return saida;
};

// Ajustes gravados no usuário (coluna acessos_personalizados)
export const lerAjustes = (usuario) => {
  const dados = usuario?.acessosPersonalizados || {};
  return {
    adicionadas: listaDeChaves(dados.adicionadas),
    removidas: listaDeChaves(dados.removidas),
    limites: limparLimites(dados.limites),
  };
};

// Limites que valem para o usuário numa ação ({} = sem limite).
// Admin e Desenvolvedor nunca têm limite.
export const limitesDaAcao = (usuario, chave) => {
  if (ehPerfilAcessoTotal(usuario?.role)) return {};
  const doUsuario = lerAjustes(usuario).limites;
  if (Object.prototype.hasOwnProperty.call(doUsuario, chave)) return doUsuario[chave];
  return LIMITES_PADRAO[chave] || {};
};

// Capacidades: ações sem rota própria (catálogo: `capacidade: true`),
// conferidas dentro do controller. Admin e Desenvolvedor sempre podem.
// Padrão: `perfisPadrao` (perfis antigos) ou PADRAO_PERFIS_RESTRITOS.
export const temAcao = (usuario, chave) => {
  const role = usuario?.role;
  if (ehPerfilAcessoTotal(role)) return true;
  const acao = ACOES_POR_CHAVE.get(chave);
  if (!acao) return false;
  const { adicionadas, removidas } = lerAjustes(usuario);
  if (removidas.includes(chave)) return false;
  if (adicionadas.includes(chave)) return true;
  if (ehPerfilRestrito(role)) return PADRAO_PERFIS_RESTRITOS[role].includes(chave);
  return (acao.perfisPadrao || []).includes(role);
};

// Valida e limpa ajustes antes de gravar. Lança erro com mensagem amigável.
export const normalizarAjustes = ({ adicionadas, removidas, limites } = {}) => {
  const ajustes = {
    adicionadas: listaDeChaves(adicionadas),
    removidas: listaDeChaves(removidas),
    limites: limparLimites(limites),
  };
  const proibidas = ajustes.adicionadas.filter((chave) => ACOES_POR_CHAVE.get(chave).somenteAdmin);
  if (proibidas.length > 0) {
    const erro = new Error(
      `Estas ações são só de administrador e não podem ser dadas: ${proibidas
        .map((chave) => ACOES_POR_CHAVE.get(chave).nome)
        .join(", ")}`,
    );
    erro.status = 400;
    throw erro;
  }
  ajustes.removidas = ajustes.removidas.filter((chave) => !ajustes.adicionadas.includes(chave));
  return ajustes;
};

// Decisão para uma requisição:
//   SEGUIR   -> sem opinião, valem as regras de perfil da rota (como antes)
//   LIBERAR  -> liberada por ajuste/lista; as regras de perfil da rota não barram
//   NEGAR    -> bloqueada
export const decidirAcesso = (usuario, metodo, url) => {
  const role = usuario?.role;
  if (ehPerfilAcessoTotal(role)) return "SEGUIR";

  const rota = encontrarRota(metodo, url);
  if (rota?.sempre) return "SEGUIR";

  const { adicionadas, removidas } = lerAjustes(usuario);

  if (ehPerfilRestrito(role)) {
    if (!rota) return "NEGAR";
    const liberada =
      (PADRAO_PERFIS_RESTRITOS[role].includes(rota.chave) || adicionadas.includes(rota.chave)) &&
      !removidas.includes(rota.chave);
    return liberada ? "LIBERAR" : "NEGAR";
  }

  if (!rota) return "SEGUIR";
  if (removidas.includes(rota.chave)) return "NEGAR";
  if (adicionadas.includes(rota.chave)) return "LIBERAR";
  return "SEGUIR";
};

const telasDe = (chaves) => [
  ...new Set(chaves.flatMap((chave) => ACOES_POR_CHAVE.get(chave)?.telas || [])),
];

// O que vai pro frontend junto com o usuário (login e /auth/perfil). Perfis
// antigos sem ajuste continuam com as regras de tela de sempre; telasLiberadas
// e telasBloqueadas só carregam o que o ajuste mudou.
export const resumoDeAcessos = (usuario) => {
  const role = usuario?.role;
  if (ehPerfilAcessoTotal(role)) return { total: true };

  const { adicionadas, removidas } = lerAjustes(usuario);
  const restrito = ehPerfilRestrito(role);
  const liberadas = restrito
    ? [...new Set([...PADRAO_PERFIS_RESTRITOS[role], ...adicionadas])].filter(
        (chave) => !removidas.includes(chave),
      )
    : adicionadas;

  return {
    total: false,
    restrito,
    adicionadas,
    removidas,
    // Perfis restritos: tudo o que podem (botões usam isso); perfis antigos
    // seguem a regra de perfil da tela e só os ajustes acima mudam algo
    liberadas: restrito ? liberadas : undefined,
    telasLiberadas: telasDe(liberadas),
    telasBloqueadas: telasDe(removidas).filter((tela) => !telasDe(liberadas).includes(tela)),
    // Nome de cada tela liberada (para a tela inicial de quem não vê o Dashboard)
    menuLiberado: liberadas
      .map((chave) => ACOES_POR_CHAVE.get(chave))
      .flatMap((acao) =>
        (acao.telas || [])
          .filter((tela) => !tela.includes(":") && tela !== "/")
          .map((tela) => ({ tela, nome: acao.nome })),
      ),
  };
};

// Padrão de cada perfil (o que vem marcado na tela de acessos). Perfis
// antigos: calculado das regras de perfil das rotas (`rotas` vem de
// listarRotasDaApi) e de `perfisPadrao` nas ações só de tela.
export const calcularPadroes = (rotas) => {
  const rolesDaRota = new Map(rotas.map((r) => [`${r.metodo} ${r.caminho}`, r.roles]));
  const padroes = Object.fromEntries(
    PERFIS_LEGADOS.map((role) => [role, []]),
  );

  for (const acao of ACOES) {
    if (acao.somenteAdmin) continue;
    for (const role of PERFIS_LEGADOS) {
      const temAcesso = acao.rotas?.length
        ? acao.rotas.every((rota) => {
            const roles = rolesDaRota.get(rota);
            return roles === null || (roles || []).includes(role);
          })
        : (acao.perfisPadrao || []).includes(role);
      if (temAcesso) padroes[role].push(acao.chave);
    }
  }

  return { ...padroes, ...PADRAO_PERFIS_RESTRITOS };
};
