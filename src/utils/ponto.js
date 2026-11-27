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

// ---------- Escala, folga e feriado ----------
// Escala do funcionário (cadastro do usuário): DIARIA (trabalha nos dias da
// semana marcados) ou 12X36 (12h de trabalho, 36h de folga: dia sim, dia não
// a partir do primeiro dia de trabalho)
export const ESCALAS = ["DIARIA", "12X36"];
export const DIAS_TRABALHO_PADRAO = [0, 1, 2, 3, 4, 5, 6]; // todos os dias (a folga é marcada no cadastro)
// Horas por mês para o valor da hora (salário ÷ horas): 220h na escala
// diária (44h por semana) e 180h na 12x36
export const HORAS_MES = { DIARIA: 220, "12X36": 180 };

const diasEntre = (de, ate) =>
  Math.round((new Date(`${ate}T12:00:00.000Z`) - new Date(`${de}T12:00:00.000Z`)) / (24 * UMA_HORA));

export const ehDiaDeTrabalho = (config, dia) => {
  if (config?.escala === "12X36") {
    if (!config.escalaInicio) return true;
    return ((diasEntre(config.escalaInicio, dia) % 2) + 2) % 2 === 0;
  }
  const dias =
    Array.isArray(config?.diasTrabalho) && config.diasTrabalho.length ? config.diasTrabalho : DIAS_TRABALHO_PADRAO;
  return dias.map(Number).includes(diaDaSemana(dia));
};

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
const pascoa = (ano) => {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const diaMes = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(diaMes).padStart(2, "0")}`;
};

const FERIADOS_FIXOS = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Consciência Negra"],
  ["12-25", "Natal"],
];

// Feriados entre `inicio` e `fim`: nacionais + os marcados como feriado no
// calendário (`locais`: [{ dataInicio, dataFim, titulo }]). Map dia -> nome
export const feriadosEntre = (inicio, fim, locais = []) => {
  const mapa = new Map();
  for (let ano = Number(inicio.slice(0, 4)); ano <= Number(fim.slice(0, 4)); ano += 1) {
    for (const [mesDia, nome] of FERIADOS_FIXOS) mapa.set(`${ano}-${mesDia}`, nome);
    mapa.set(somarDias(pascoa(ano), -2), "Sexta-feira Santa");
  }
  for (const local of locais) {
    for (let dia = local.dataInicio; dia <= local.dataFim; dia = somarDias(dia, 1)) {
      mapa.set(dia, local.titulo || "Feriado");
    }
  }
  for (const dia of [...mapa.keys()]) if (dia < inicio || dia > fim) mapa.delete(dia);
  return mapa;
};

// TRABALHO, FOLGA ou FERIADO (só para mostrar). Feriado não é folga: a jornada
// segue a escala; só a hora extra do dia vale 100%
export const tipoDoDia = (config, dia, feriados = new Map()) =>
  feriados.has(dia) ? "FERIADO" : ehDiaDeTrabalho(config, dia) ? "TRABALHO" : "FOLGA";

// Dias da escala (também os futuros), para o calendário do funcionário
export const diasDaEscala = ({ config, inicio, fim, feriados = new Map() }) => {
  const dias = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) {
    const tipo = tipoDoDia(config, dia, feriados);
    dias.push({ dia, tipo, feriadoNome: feriados.get(dia) || null, trabalhoPelaEscala: ehDiaDeTrabalho(config, dia) });
  }
  return dias;
};

// Valor da hora e das extras: hora = salário ÷ horas do mês; extra 50% nos
// dias normais e 100% em domingo e feriado
export const valorDaHora = (config) => {
  const salario = Number(config?.salario || 0);
  if (!(salario > 0)) return 0;
  return salario / (HORAS_MES[config?.escala] || HORAS_MES.DIARIA);
};
export const valorDasExtras = (config, extra50Minutos, extra100Minutos) => {
  const hora = valorDaHora(config);
  return Number(((extra50Minutos / 60) * hora * 1.5 + (extra100Minutos / 60) * hora * 2).toFixed(2));
};
// Diária: a do cadastro, ou salário ÷ 30
export const valorDaDiaria = (config) => {
  const diaria = Number(config?.valorDiaria || 0);
  if (diaria > 0) return diaria;
  const salario = Number(config?.salario || 0);
  return salario > 0 ? Number((salario / 30).toFixed(2)) : 0;
};

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
// `tipoDia`: TRABALHO, FOLGA ou FERIADO. `diaDeTrabalho`: pela escala.
// Folga não tem jornada: tudo o que trabalhar é extra (sem débito). Domingo e
// feriado seguem a escala; só a extra deles vale 100%.
export const resumirDia = ({
  dia,
  batidas,
  jornadaMinutos,
  ultimaSaidaAnterior,
  agora = new Date(),
  tipoDia = "TRABALHO",
  feriadoNome = null,
  diaDeTrabalho = tipoDia !== "FOLGA",
}) => {
  const jornadaDoDia = diaDeTrabalho ? jornadaMinutos : 0;
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
  // Almoço não feito (dia com mais de 6h e intervalo menor que 1h) não conta
  // como hora extra: esses minutos saem da extra
  const faltaIntervalo = trabalhado > 6 * 60 ? Math.max(0, 60 - intervalo) : 0;
  let intervaloDescontado = 0;
  const fechado = batidas.length > 0 && !emAndamento && !incompleto;
  if (fechado) {
    const diferenca = trabalhado - jornadaDoDia;
    if (diferenca > TOLERANCIA_DIARIA_MIN) {
      intervaloDescontado = Math.min(faltaIntervalo, diferenca);
      extra = diferenca - intervaloDescontado;
    } else if (diferenca < -TOLERANCIA_DIARIA_MIN && diaDeTrabalho && tipoDia !== "FERIADO") debito = -diferenca;
  }
  // Extra 100% em domingo e feriado; 50% nos outros dias
  const cemPorCento = tipoDia === "FERIADO" || diaDaSemana(dia) === 0;
  // Em andamento: quanto já passou da jornada do dia (alerta)
  const passouDaJornada =
    emAndamento && trabalhadoAteAgora - jornadaDoDia > TOLERANCIA_DIARIA_MIN ? trabalhadoAteAgora - jornadaDoDia : 0;

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
  if (intervaloDescontado > 0) {
    avisos.push(`${intervaloDescontado} min de almoço não feito não contam como hora extra`);
  }
  if (batidas.length && !diaDeTrabalho) avisos.push("Trabalhou na folga: todas as horas contam como extra");
  if (batidas.length && tipoDia === "FERIADO") avisos.push(`Feriado${feriadoNome ? ` (${feriadoNome})` : ""}: a hora extra vale 100%`);
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
    tipoDia,
    feriadoNome,
    diaDeTrabalho,
    batidas,
    jornadaMinutos: jornadaDoDia,
    extra50Minutos: cemPorCento ? 0 : extra,
    extra100Minutos: cemPorCento ? extra : 0,
    intervaloDescontadoMinutos: intervaloDescontado,
    passouDaJornadaMinutos: passouDaJornada,
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
// `config`: escala do funcionário ({ escala, diasTrabalho, escalaInicio });
// `feriados`: Map dia -> nome (feriadosEntre)
export const montarEspelho = ({ inicio, fim, batidas, jornadaMinutos, agora = new Date(), config = null, feriados = new Map() }) => {
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
    const resumo = resumirDia({
      dia,
      batidas: lista,
      jornadaMinutos,
      ultimaSaidaAnterior: ultimaSaida,
      agora,
      tipoDia: tipoDoDia(config, dia, feriados),
      feriadoNome: feriados.get(dia) || null,
      diaDeTrabalho: ehDiaDeTrabalho(config, dia),
    });
    dias.push(resumo);
    const saida = [...lista].reverse().find((b) => b.tipo === "SAIDA");
    if (saida) ultimaSaida = saida.dataHora;
    else if (lista.length) ultimaSaida = null;
  }

  const totais = dias.reduce(
    (soma, dia) => ({
      trabalhadoMinutos: soma.trabalhadoMinutos + dia.trabalhadoMinutos,
      extraMinutos: soma.extraMinutos + dia.extraMinutos,
      extra50Minutos: soma.extra50Minutos + dia.extra50Minutos,
      extra100Minutos: soma.extra100Minutos + dia.extra100Minutos,
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
      extra50Minutos: 0,
      extra100Minutos: 0,
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
