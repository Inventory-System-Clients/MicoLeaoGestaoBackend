import { sequelize } from "../database/connection.js";

// SKU de produto (campo `codigo`) gerado pelo sistema: 001, 002, 003...
// Sempre o maior SKU numérico já usado + 1, então nunca repete nem reaproveita
// número. SKUs antigos em outro formato (ex.: "PROD-001") ficam como estão e
// não entram na conta, nem números longos (código de barras, 7+ dígitos), pra
// não fazer o contador saltar. Só produtos; insumos e peças seguem digitados.
// Se um SKU gerado bater com um antigo, o índice único do banco recusa.
//
// Precisa rodar dentro de uma transação: o lock garante que duas criações ao
// mesmo tempo não peguem o mesmo número (o 2º espera o 1º terminar).
export const gerarSkuProduto = async (transaction) => {
  if (!transaction) {
    throw new Error("gerarSkuProduto precisa de uma transação");
  }

  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('sku_produto'))", {
    transaction,
  });

  const [[{ maior }]] = await sequelize.query(
    `SELECT MAX(CAST(codigo AS BIGINT)) AS maior
       FROM produtos
      WHERE codigo ~ '^[0-9]{1,6}$'`,
    { transaction },
  );

  return String(Number(maior || 0) + 1).padStart(3, "0");
};
