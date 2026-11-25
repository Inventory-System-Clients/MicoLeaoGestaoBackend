import { Op } from "sequelize";
import { Loja, Shopping } from "../models/index.js";

// Shopping nos relatórios: filtro (?shoppingId=<id> ou "sem" = fora de
// shopping) e soma por shopping. Máquina avulsa é Loja com tipo AVULSA, então
// entra como ponto do shopping dela.

export const SEM_SHOPPING = "sem";

// where de Loja para o filtro (vazio = todas)
export const whereLojaDoShopping = (shoppingId) => {
  if (!shoppingId) return {};
  if (shoppingId === SEM_SHOPPING) return { shoppingId: null };
  return { shoppingId };
};

// Ids das lojas do shopping (null = sem filtro)
export const lojaIdsDoShopping = async (shoppingId) => {
  if (!shoppingId) return null;
  const lojas = await Loja.findAll({ where: whereLojaDoShopping(shoppingId), attributes: ["id"], raw: true });
  return lojas.map((loja) => loja.id);
};

export const nomesDosShoppings = async () => {
  const shoppings = await Shopping.findAll({ attributes: ["id", "nome"], raw: true });
  return new Map(shoppings.map((s) => [s.id, s.nome]));
};

// Soma campos numéricos de linhas por loja ({ shoppingId, ... }) por shopping
export const somarPorShopping = (linhas, campos, nomes) => {
  const grupos = new Map();
  for (const linha of linhas) {
    const chave = linha.shoppingId || SEM_SHOPPING;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        shoppingId: chave,
        shoppingNome: chave === SEM_SHOPPING ? "Fora de shopping" : nomes.get(chave) || "Shopping",
        lojas: 0,
        avulsas: 0,
        ...Object.fromEntries(campos.map((campo) => [campo, 0])),
      });
    }
    const grupo = grupos.get(chave);
    if (linha.tipo === "AVULSA") grupo.avulsas += 1;
    else grupo.lojas += 1;
    for (const campo of campos) grupo[campo] += Number(linha[campo] || 0);
  }
  return [...grupos.values()];
};

export const opLojaIds = (ids) => ({ [Op.in]: ids });
