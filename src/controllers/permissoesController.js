import { CATALOGO } from "../permissoes/catalogo.js";
import { calcularPadroes, LIMITES_PADRAO } from "../permissoes/acessos.js";

// O padrão dos perfis antigos sai das regras de perfil de cada rota. A lista
// de rotas é lida uma vez (import dinâmico: rotasDaApi importa as rotas, que
// importam este controller).
let padroesEmCache = null;
const obterPadroes = async () => {
  if (!padroesEmCache) {
    const { listarRotasDaApi } = await import("../permissoes/rotasDaApi.js");
    padroesEmCache = calcularPadroes(listarRotasDaApi());
  }
  return padroesEmCache;
};

// Catálogo para a tela de acessos do usuário (sem as rotas da API)
export const obterCatalogo = async (req, res) => {
  try {
    res.json({
      areas: CATALOGO.map((area) => ({
        area: area.area,
        nome: area.nome,
        acoes: area.acoes.map(({ chave, nome, requer, somenteAdmin, telas, limites }) => ({
          chave,
          nome,
          requer: requer || [],
          somenteAdmin: Boolean(somenteAdmin),
          telas: telas || [],
          limites: limites || [],
        })),
      })),
      padroes: await obterPadroes(),
      // Limites que já vêm para todos (menos Admin/Desenvolvedor)
      limitesPadrao: LIMITES_PADRAO,
    });
  } catch (error) {
    console.error("Erro ao montar catálogo de acessos:", error);
    res.status(500).json({ error: "Erro ao carregar catálogo de acessos" });
  }
};
