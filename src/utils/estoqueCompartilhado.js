import { Loja } from "../models/index.js";

// Estoque emprestado: uma loja (ou máquina avulsa) pode usar o estoque de
// outra loja (Loja.estoqueLojaId). O abastecimento da movimentação sai de lá
// e a devolução volta para lá. Um nível só: quem empresta não pode estar
// usando o estoque de outra (validado no cadastro da loja).
export const lojaDoEstoque = async (lojaId, opcoes = {}) => {
  if (!lojaId) return lojaId;
  const loja = await Loja.findByPk(lojaId, { attributes: ["id", "estoqueLojaId"], ...opcoes });
  return loja?.estoqueLojaId || lojaId;
};
