import { limitesDaAcao } from "./acessos.js";

// Ajuda os controllers a aplicar os limites de acesso (catálogo: `limites`).
// Datas no horário de Brasília (o servidor roda em UTC).
const FUSO = "-03:00";

const diaDeHojeEmBrasilia = () =>
  new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Começo do período "últimos N dias": hoje conta como o 1º dia.
// dias = 3 -> desde 00:00 de anteontem.
export const inicioDosUltimosDias = (dias) => {
  const inicio = new Date(`${diaDeHojeEmBrasilia()}T00:00:00.000${FUSO}`);
  inicio.setUTCDate(inicio.getUTCDate() - (dias - 1));
  return inicio;
};

// Data inválida/ausente conta como "não é de hoje" (bloqueia em vez de quebrar)
export const ehDeHojeEmBrasilia = (data) => {
  const momento = new Date(data).getTime();
  if (!Number.isFinite(momento)) return false;
  return (
    new Date(momento - 3 * 60 * 60 * 1000).toISOString().slice(0, 10) ===
    diaDeHojeEmBrasilia()
  );
};

export const limitesDe = (req, chave) => limitesDaAcao(req.usuario, chave);

// Aplica "últimos N dias" num filtro de data já montado ({ [Op.gte], [Op.lte] }
// ou { [Op.between]: [inicio, fim] }): o começo nunca fica antes do limite.
export const restringirPeriodo = (filtroAtual, Op, dias) => {
  if (!dias) return filtroAtual;
  const limite = inicioDosUltimosDias(dias);
  if (!filtroAtual) return { [Op.gte]: limite };

  if (filtroAtual[Op.between]) {
    const [inicio, fim] = filtroAtual[Op.between];
    return { [Op.between]: [inicio > limite ? inicio : limite, fim] };
  }

  const inicio = filtroAtual[Op.gte];
  return { ...filtroAtual, [Op.gte]: inicio && inicio > limite ? inicio : limite };
};
