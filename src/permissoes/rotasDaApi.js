// Percorre o router da API (routes/index.js) e devolve cada rota com:
//   metodo, caminho ("/api/manutencoes/:id/status"),
//   autenticada (passa pelo `autenticar`),
//   roles: perfis que os middlewares de perfil deixam passar
//          (null = qualquer usuário logado).
// Usado pelo script de conferência de permissões (scripts/verificarPermissoes.js).
import apiRouter from "../routes/index.js";
import { autenticar } from "../middlewares/auth.js";

const prefixoDaCamada = (layer) => {
  // Express 4: router.use("/manutencoes", ...) vira /^\/manutencoes\/?(?=\/|$)/i
  const fonte = layer.regexp?.source || "";
  if (fonte === "^\\/?$" || fonte === "^\\/?(?=\\/|$)") return "";
  return fonte
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\//g, "/");
};

const intersecao = (atual, nova) =>
  atual === null ? [...nova] : atual.filter((role) => nova.includes(role));

const aplicarMiddleware = (estado, handle) => {
  if (handle === autenticar) return { ...estado, autenticada: true };
  if (Array.isArray(handle.rolesPermitidas)) {
    return { ...estado, roles: intersecao(estado.roles, handle.rolesPermitidas) };
  }
  return estado;
};

const percorrer = (router, prefixo, estadoInicial, saida) => {
  let estado = estadoInicial;

  for (const layer of router.stack) {
    if (layer.route) {
      let estadoRota = estado;
      for (const camada of layer.route.stack) {
        estadoRota = aplicarMiddleware(estadoRota, camada.handle);
      }
      for (const metodo of Object.keys(layer.route.methods)) {
        saida.push({
          metodo: metodo.toUpperCase(),
          caminho: `${prefixo}${layer.route.path === "/" ? "" : layer.route.path}` || "/",
          autenticada: estadoRota.autenticada,
          roles: estadoRota.roles,
        });
      }
    } else if (layer.handle?.stack) {
      // Sub-router montado com router.use("/x", sub)
      percorrer(layer.handle, `${prefixo}${prefixoDaCamada(layer)}`, estado, saida);
    } else {
      // router.use(middleware) vale para tudo que vem depois neste router
      estado = aplicarMiddleware(estado, layer.handle);
    }
  }
};

export const listarRotasDaApi = () => {
  const saida = [];
  percorrer(apiRouter, "/api", { autenticada: false, roles: null }, saida);
  return saida;
};
