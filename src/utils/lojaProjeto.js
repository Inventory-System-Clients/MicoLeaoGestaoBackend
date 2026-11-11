import { Op } from "sequelize";

// Loja nova criada dentro de um Projeto Loja: já existe no banco (pra poder
// cadastrar gastos fixos, extintores etc.), mas ainda não é loja de verdade.
// Fica com status EM_IMPLANTACAO e ativo = false até o projeto ser concluído,
// e por isso não aparece em listagens, alertas nem relatórios (todos filtram
// ativo = true). Lojas EM_IMPLANTACAO antigas, cadastradas à mão, têm
// ativo = true e continuam aparecendo normalmente.
export const STATUS_LOJA_EM_IMPLANTACAO = "EM_IMPLANTACAO";

export const ehLojaDeProjetoEmImplantacao = (loja) =>
  loja?.statusOperacao === STATUS_LOJA_EM_IMPLANTACAO && loja?.ativo === false;

// Filtro Sequelize que esconde essas lojas (ativo nulo conta como visível).
export const whereSemLojaDeProjeto = {
  [Op.or]: [
    { statusOperacao: { [Op.ne]: STATUS_LOJA_EM_IMPLANTACAO } },
    { ativo: { [Op.ne]: false } },
    { ativo: null },
  ],
};
