// Regras do ponto: sequência das batidas, distância até os locais e o cálculo
// de horas de cada dia (trabalhado, intervalo, extra, débito e avisos).
// Datas no horário de Brasília (o servidor roda em UTC), como em
// permissoes/limites.js.

const FUSO = "-03:00";
const UMA_HORA = 60 * 60 * 1000;

export const TIPOS_PONTO = ["ENTRADA", "SAIDA_INTERVALO", "VOLTA_INTERVALO", "SAIDA"];

// Tolerância diária (CLT art. 58 §1º): até 10 min a mais ou a menos no dia
// não conta como extra nem como débito
export const TOLERANCIA_DIARIA_MIN = 10;
// Jornada aberta há mais que isso é dada como esquecida: libera nova entrada
const HORAS_JORNADA_ESQUECIDA = 16;
// Evita batida dupla por clique repetido
export const SEGUNDOS_ENTRE_BATIDAS = 60;
// Precisão do GPS acima disso aparece como "baixa precisão"
export const PRECISAO_BAIXA_METROS = 100;

// "2026-11-11" do momento, no horário de Brasília
export const diaEmBrasilia = (data = new Date()) =>
  new Date(new Date(data).getTime() - 3 * UMA_HORA).toISOString().slice(0, 10);

export const inicioDoDia = (dia) => new Date(`${dia}T00:00:00.000${FUSO}`);
export const fimDoDia = (dia) => new Date(`${dia}T23:59:59.999${FUSO}`);

export const somarDias = (dia, quantidade) => {
  const data = new Date(`${dia}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + quantidade);
  return data.toISOString().slice(0, 10);
};

// 0 = domingo
export const diaDaSemana = (dia) => new Date(`${dia}T12:00:00.000Z`).getUTCDay();

// Distância em metros entre dois pontos (fórmula de Haversine)
export const distanciaEmMetros = (lat1, lon1, lat2, lon2) => {
  const raio = 6371000;
  const rad = (grau) => (Number(grau) * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * raio * Math.asin(Math.sqrt(a)));
};

// Local cadastrado mais próximo da posição: { local, distancia, dentro }
export const localMaisProximo = (latitude, longitude, locais) => {
  let melhor = null;
  for (const local of locais) {
    const distancia = distanciaEmMetros(latitude, longitude, local.latitude, local.longitude);
    if (!melhor || distancia < melhor.distancia) melhor = { local, distancia };
  }
  if (!melhor) return { local: null, distancia: null, dentro: false };
  return { ...melhor, dentro: melhor.distancia <= Number(melhor.local.raioMetros || 0) };
};

// Quais batidas podem vir agora, dada a última batida válida
export const proximasBatidas = (ultima, agora = new Date()) => {
  if (!ultima || ultima.tipo === "SAIDA") return ["ENTRADA"];
  const horasAberta = (agora.getTime() - new Date(ultima.dataHora).getTime()) / UMA_HORA;
  if (horasAberta > HORAS_JORNADA_ESQUECIDA) return ["ENTRADA"];
  if (ultima.tipo === "ENTRADA") return ["SAIDA_INTERVALO", "SAIDA"];
  if (ultima.tipo === "SAIDA_INTERVALO") return ["VOLTA_INTERVALO"];
  return ["SAIDA"];
};

const ABRE = new Set(["ENTRADA", "VOLTA_INTERVALO"]);
const FECHA = new Set(["SAIDA_INTERVALO", "SAIDA"]);
const minutosEntre = (inicio, fim) =>
  Math.max(0, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000));

// Resumo de um dia de trabalho. `batidas`: as válidas do dia, em ordem.
// `ultimaSaidaAnterior`: última saída do dia de trabalho anterior (pro aviso
// de descanso entre jornadas).
export const resumirDia = ({ dia, batidas, jornadaMinutos, ultimaSaidaAnterior, agora = new Date() }) => {
  let trabalhado = 0;
  let intervalo = 0;
  let abertoDesde = null;
  let saidaIntervalo = null;
  let sequenciaQuebrada = false;

  for (const batida of batidas) {
    if (ABRE.has(batida.tipo)) {
      if (abertoDesde) sequenciaQuebrada = true;
      if (batida.tipo === "VOLTA_INTERVALO" && saidaIntervalo) {
        intervalo += minutosEntre(saidaIntervalo, batida.dataHora);
        saidaIntervalo = null;
      }
      abertoDesde = batida.dataHora;
    } else if (FECHA.has(batida.tipo)) {
      if (!abertoDesde) {
        sequenciaQuebrada = true;
        continue;
      }
      trabalhado += minutosEntre(abertoDesde, batida.dataHora);
      abertoDesde = null;
      if (batida.tipo === "SAIDA_INTERVALO") saidaIntervalo = batida.dataHora;
    }
  }

  const ultima = batidas[batidas.length - 1] || null;
  const aberta = Boolean(abertoDesde) || ultima?.tipo === "SAIDA_INTERVALO";
  const emAndamento =
    aberta && ultima && proximasBatidas(ultima, agora)[0] !== "ENTRADA";
  const incompleto = (aberta && !emAndamento) || sequenciaQuebrada;

  // Em andamento: conta até agora (só pra mostrar; extra/débito só no fim)
  const trabalhadoAteAgora =
    trabalhado + (emAndamento && abertoDesde ? minutosEntre(abertoDesde, agora) : 0);

  let extra = 0;
  let debito = 0;
  const fechado = batidas.length > 0 && !emAndamento && !incompleto;
  if (fechado) {
    const diferenca = trabalhado - jornadaMinutos;
    if (diferenca > TOLERANCIA_DIARIA_MIN) extra = diferenca;
    else if (diferenca < -TOLERANCIA_DIARIA_MIN) debito = -diferenca;
  }

  const avisos = [];
  if (incompleto) avisos.push("Batidas incompletas: falta marcar a saída ou alguma batida ficou fora de ordem");
  if (fechado && trabalhado > 6 * 60) {
    if (!batidas.some((b) => b.tipo === "SAIDA_INTERVALO")) {
      avisos.push("Mais de 6h sem intervalo registrado (CLT exige no mínimo 1h)");
    } else if (intervalo < 60) {
      avisos.push(`Intervalo de ${intervalo} min, menor que 1h`);
    }
  }
  if (extra > 120) avisos.push("Mais de 2h extras no dia (limite da CLT)");
  const primeiraEntrada = batidas.find((b) => b.tipo === "ENTRADA");
  if (primeiraEntrada && ultimaSaidaAnterior) {
    const descanso = minutosEntre(ultimaSaidaAnterior, primeiraEntrada.dataHora);
    if (descanso < 11 * 60) {
      avisos.push(`Descanso de ${Math.floor(descanso / 60)}h${String(descanso % 60).padStart(2, "0")} desde a jornada anterior (mínimo 11h)`);
    }
  }
  const foraDoLocal = batidas.filter((b) => b.foraDoLocal).length;
  if (foraDoLocal) avisos.push(`${foraDoLocal} batida(s) fora dos locais cadastrados`);
  const ajustes = batidas.filter((b) => b.origem === "AJUSTE").length;

  return {
    dia,
    diaDaSemana: diaDaSemana(dia),
    batidas,
    jornadaMinutos,
    trabalhadoMinutos: emAndamento ? trabalhadoAteAgora : trabalhado,
    intervaloMinutos: intervalo,
    extraMinutos: extra,
    debitoMinutos: debito,
    situacao: batidas.length === 0
      ? "SEM_REGISTRO"
      : emAndamento
        ? "EM_ANDAMENTO"
        : incompleto
          ? "INCOMPLETO"
          : "COMPLETO",
    foraDoLocal,
    ajustes,
    avisos,
  };
};

// Dias de `inicio` a `fim` (inclusive), com os totais do período.
// `batidas`: válidas do usuário no período (e um pouco antes, pro descanso).
export const montarEspelho = ({ inicio, fim, batidas, jornadaMinutos, agora = new Date() }) => {
  const porDia = new Map();
  for (const batida of batidas) {
    if (!porDia.has(batida.dataReferencia)) porDia.set(batida.dataReferencia, []);
    porDia.get(batida.dataReferencia).push(batida);
  }
  for (const lista of porDia.values()) {
    lista.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
  }

  const diasAnteriores = [...porDia.keys()].filter((dia) => dia < inicio).sort();
  let ultimaSaida = null;
  if (diasAnteriores.length) {
    const lista = porDia.get(diasAnteriores[diasAnteriores.length - 1]);
    ultimaSaida = [...lista].reverse().find((b) => b.tipo === "SAIDA")?.dataHora || null;
  }

  const dias = [];
  const hoje = diaEmBrasilia(agora);
  for (let dia = inicio; dia <= fim && dia <= hoje; dia = somarDias(dia, 1)) {
    const lista = porDia.get(dia) || [];
    const resumo = resumirDia({ dia, batidas: lista, jornadaMinutos, ultimaSaidaAnterior: ultimaSaida, agora });
    dias.push(resumo);
    const saida = [...lista].reverse().find((b) => b.tipo === "SAIDA");
    if (saida) ultimaSaida = saida.dataHora;
    else if (lista.length) ultimaSaida = null;
  }

  const totais = dias.reduce(
    (soma, dia) => ({
      trabalhadoMinutos: soma.trabalhadoMinutos + dia.trabalhadoMinutos,
      extraMinutos: soma.extraMinutos + dia.extraMinutos,
      debitoMinutos: soma.debitoMinutos + dia.debitoMinutos,
      diasTrabalhados: soma.diasTrabalhados + (dia.batidas.length ? 1 : 0),
      diasIncompletos: soma.diasIncompletos + (dia.situacao === "INCOMPLETO" ? 1 : 0),
      foraDoLocal: soma.foraDoLocal + dia.foraDoLocal,
      ajustes: soma.ajustes + dia.ajustes,
      avisos: soma.avisos + dia.avisos.length,
    }),
    {
      trabalhadoMinutos: 0,
      extraMinutos: 0,
      debitoMinutos: 0,
      diasTrabalhados: 0,
      diasIncompletos: 0,
      foraDoLocal: 0,
      ajustes: 0,
      avisos: 0,
    },
  );
  totais.saldoMinutos = totais.extraMinutos - totais.debitoMinutos;

  // Mais recente primeiro
  return { dias: dias.reverse(), totais };
};
