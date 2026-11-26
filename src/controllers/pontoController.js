import { Op } from "sequelize";
import { RegistroPonto, LocalPonto, Usuario, Loja, PeriodoCalendario, PontoExtraDia } from "../models/index.js";
import {
  TIPOS_PONTO,
  SEGUNDOS_ENTRE_BATIDAS,
  diaEmBrasilia,
  inicioDoDia,
  fimDoDia,
  somarDias,
  localMaisProximo,
  proximasBatidas,
  montarEspelho,
  feriadosEntre,
  diasDaEscala,
  valorDaHora,
  valorDasExtras,
  valorDaDiaria,
} from "../utils/ponto.js";

// Admin e Desenvolvedor não batem ponto
const PERFIS_SEM_PONTO = ["ADMIN", "DESENVOLVEDOR"];

const DIA_VALIDO = /^\d{4}-\d{2}-\d{2}$/;

// Período pedido (?inicio=&fim=); sem nada, o mês atual até hoje
const lerPeriodo = (query) => {
  const hoje = diaEmBrasilia();
  const fim = DIA_VALIDO.test(query.fim || "") ? query.fim : hoje;
  const inicio = DIA_VALIDO.test(query.inicio || "") ? query.inicio : `${fim.slice(0, 7)}-01`;
  return inicio <= fim ? { inicio, fim } : { inicio: fim, fim: inicio };
};

const numero = (valor) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : null;
};

const ATRIBUTOS_USUARIO = ["id", "nome", "role", "jornadaDiariaMinutos", "escala", "diasTrabalho", "escalaInicio", "salario", "valorDiaria"];

// Escala do funcionário (cadastro do usuário)
const configDe = (usuario) => ({
  escala: usuario.escala || "DIARIA",
  diasTrabalho: usuario.diasTrabalho,
  escalaInicio: usuario.escalaInicio,
  salario: usuario.salario,
  valorDiaria: usuario.valorDiaria,
});

// Feriados do período: nacionais + os períodos do calendário marcados como feriado
const carregarFeriados = async (inicio, fim) => {
  const locais = await PeriodoCalendario.findAll({
    where: { feriado: true, dataInicio: { [Op.lte]: fim }, dataFim: { [Op.gte]: inicio } },
    attributes: ["titulo", "dataInicio", "dataFim"],
    raw: true,
  }).catch(() => []);
  return feriadosEntre(inicio, fim, locais);
};

const incluirDetalhes = [
  { model: LocalPonto, as: "local", attributes: ["id", "nome", "raioMetros"] },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  { model: Usuario, as: "desconsideradaPor", attributes: ["id", "nome"] },
];

// Batida pro frontend (DECIMAL vem como texto do Postgres)
const formatar = (registro) => {
  const dados = registro.toJSON ? registro.toJSON() : registro;
  return {
    ...dados,
    latitude: dados.latitude === null ? null : Number(dados.latitude),
    longitude: dados.longitude === null ? null : Number(dados.longitude),
  };
};

const formatarLocal = (local) => {
  const dados = local.toJSON ? local.toJSON() : local;
  return { ...dados, latitude: Number(dados.latitude), longitude: Number(dados.longitude) };
};

const locaisAtivos = async () =>
  (await LocalPonto.findAll({ where: { ativo: true }, order: [["nome", "ASC"]] })).map(formatarLocal);

const ultimaBatidaValida = (usuarioId, transaction) =>
  RegistroPonto.findOne({
    where: { usuarioId, desconsiderada: false },
    order: [["dataHora", "DESC"]],
    transaction,
  });

// Batidas válidas do período + 3 dias antes (descanso entre jornadas)
const batidasDoPeriodo = async (usuarioId, inicio, fim) =>
  (
    await RegistroPonto.findAll({
      where: {
        usuarioId,
        desconsiderada: false,
        dataReferencia: { [Op.between]: [somarDias(inicio, -3), fim] },
      },
      include: incluirDetalhes,
      order: [["dataHora", "ASC"]],
    })
  ).map(formatar);

const espelhoDoUsuario = async (usuario, inicio, fim, feriados = null) =>
  montarEspelho({
    inicio,
    fim,
    batidas: await batidasDoPeriodo(usuario.id, inicio, fim),
    jornadaMinutos: usuario.jornadaDiariaMinutos ?? 480,
    config: configDe(usuario),
    feriados: feriados || (await carregarFeriados(inicio, fim)),
  });

const funcionariosComPonto = () =>
  Usuario.findAll({
    where: { ativo: true, role: { [Op.notIn]: PERFIS_SEM_PONTO } },
    attributes: ATRIBUTOS_USUARIO,
    order: [["nome", "ASC"]],
  });

const pontoController = {
  // Tela do funcionário: situação agora, dias do período e locais
  async meuPonto(req, res) {
    try {
      const usuario = req.usuario;
      const { inicio, fim } = lerPeriodo(req.query);
      const [ultima, espelho, locais] = await Promise.all([
        ultimaBatidaValida(usuario.id),
        espelhoDoUsuario(usuario, inicio, fim),
        locaisAtivos(),
      ]);
      const hoje = await espelhoDoUsuario(usuario, somarDias(diaEmBrasilia(), -1), diaEmBrasilia());
      // Jornada aberta desde ontem (virada da meia-noite) aparece como "hoje"
      const diaAtual =
        hoje.dias.find((dia) => dia.situacao === "EM_ANDAMENTO") || hoje.dias[0] || null;
      // Calendário do mês (?mes=AAAA-MM): dias de trabalho, folga e feriado
      const mes = /^\d{4}-\d{2}$/.test(req.query.mes || "") ? req.query.mes : diaEmBrasilia().slice(0, 7);
      const inicioMes = `${mes}-01`;
      const fimMes = somarDias(`${somarDias(inicioMes, 32).slice(0, 7)}-01`, -1);
      const feriadosMes = await carregarFeriados(inicioMes, fimMes);
      const espelhoMes = await espelhoDoUsuario(usuario, inicioMes, fimMes, feriadosMes);
      const horasPorDia = new Map(espelhoMes.dias.map((d) => [d.dia, d]));
      const calendario = diasDaEscala({ config: configDe(usuario), inicio: inicioMes, fim: fimMes, feriados: feriadosMes }).map(
        (d) => {
          const feito = horasPorDia.get(d.dia);
          return {
            ...d,
            trabalhadoMinutos: feito?.trabalhadoMinutos || 0,
            extraMinutos: feito?.extraMinutos || 0,
            situacao: feito?.situacao || "SEM_REGISTRO",
          };
        },
      );

      res.json({
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          jornadaDiariaMinutos: usuario.jornadaDiariaMinutos,
          escala: usuario.escala || "DIARIA",
        },
        calendario: { mes, dias: calendario },
        semPonto: PERFIS_SEM_PONTO.includes(usuario.role),
        ultima: ultima ? formatar(ultima) : null,
        proximas: proximasBatidas(ultima),
        hoje: diaAtual,
        periodo: { inicio, fim },
        ...espelho,
        locais,
        agora: new Date(),
      });
    } catch (error) {
      console.error("Erro ao carregar ponto:", error);
      res.status(500).json({ error: "Erro ao carregar o ponto" });
    }
  },

  // Bater o ponto. Hora e local mais próximo são decididos aqui no servidor.
  async bater(req, res) {
    const usuario = req.usuario;
    if (PERFIS_SEM_PONTO.includes(usuario.role)) {
      return res.status(400).json({ error: "Administrador não bate ponto." });
    }
    const { tipo, observacao } = req.body;
    const latitude = numero(req.body.latitude);
    const longitude = numero(req.body.longitude);
    const precisao = numero(req.body.precisao);

    if (!TIPOS_PONTO.includes(tipo)) {
      return res.status(400).json({ error: "Tipo de batida inválido." });
    }
    if (
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return res.status(400).json({
        error: "Não foi possível ler sua localização. Libere a localização no celular e tente de novo.",
      });
    }

    try {
      const transaction = await RegistroPonto.sequelize.transaction();
      try {
        // Uma batida por vez por usuário (dois cliques ao mesmo tempo)
        await RegistroPonto.sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:chave))", {
          replacements: { chave: `ponto_${usuario.id}` },
          transaction,
        });
        const agora = new Date();
        const ultima = await ultimaBatidaValida(usuario.id, transaction);
        const permitidas = proximasBatidas(ultima, agora);
        if (!permitidas.includes(tipo)) {
          await transaction.rollback();
          return res.status(409).json({
            error: "Essa batida não é a próxima. Atualize a tela e tente de novo.",
            proximas: permitidas,
          });
        }
        if (ultima && agora - new Date(ultima.dataHora) < SEGUNDOS_ENTRE_BATIDAS * 1000) {
          await transaction.rollback();
          return res.status(409).json({
            error: "Você acabou de bater o ponto. Espere um minuto para a próxima batida.",
          });
        }

        const proximo = localMaisProximo(latitude, longitude, await locaisAtivos());
        const registro = await RegistroPonto.create(
          {
            usuarioId: usuario.id,
            tipo,
            dataHora: agora,
            dataReferencia: tipo === "ENTRADA" ? diaEmBrasilia(agora) : ultima.dataReferencia,
            latitude,
            longitude,
            precisaoMetros: precisao === null ? null : Math.round(precisao),
            localPontoId: proximo.local?.id || null,
            distanciaMetros: proximo.distancia,
            foraDoLocal: !proximo.dentro,
            observacao: observacao ? String(observacao).slice(0, 255) : null,
            origem: "FUNCIONARIO",
            criadoPorId: usuario.id,
            ip: String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 64),
            dispositivo: String(req.headers["user-agent"] || "").slice(0, 255),
          },
          { transaction },
        );
        await transaction.commit();

        const completo = await RegistroPonto.findByPk(registro.id, { include: incluirDetalhes });
        res.status(201).json(formatar(completo));
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error("Erro ao bater ponto:", error);
      res.status(500).json({ error: "Erro ao registrar o ponto" });
    }
  },

  // ---------- Administrador ----------

  // Agora: situação de cada funcionário hoje
  async painel(req, res) {
    try {
      const hoje = diaEmBrasilia();
      const ontem = somarDias(hoje, -1);
      const funcionarios = await funcionariosComPonto();
      const feriados = await carregarFeriados(ontem, hoje);
      const batidas = (
        await RegistroPonto.findAll({
          where: {
            desconsiderada: false,
            dataReferencia: { [Op.between]: [somarDias(hoje, -2), hoje] },
          },
          include: incluirDetalhes,
          order: [["dataHora", "ASC"]],
        })
      ).map(formatar);

      const porUsuario = new Map();
      for (const batida of batidas) {
        if (!porUsuario.has(batida.usuarioId)) porUsuario.set(batida.usuarioId, []);
        porUsuario.get(batida.usuarioId).push(batida);
      }

      const lista = funcionarios.map((funcionario) => {
        const espelho = montarEspelho({
          inicio: ontem,
          fim: hoje,
          batidas: porUsuario.get(funcionario.id) || [],
          jornadaMinutos: funcionario.jornadaDiariaMinutos ?? 480,
          config: configDe(funcionario),
          feriados,
        });
        const dia =
          espelho.dias.find((d) => d.situacao === "EM_ANDAMENTO") ||
          espelho.dias.find((d) => d.dia === hoje);
        const ultima = dia?.batidas[dia.batidas.length - 1] || null;
        let status = "NAO_BATEU";
        if (dia?.situacao === "EM_ANDAMENTO") {
          status = ultima?.tipo === "SAIDA_INTERVALO" ? "INTERVALO" : "TRABALHANDO";
        } else if (dia?.batidas.length) {
          status = dia.situacao === "INCOMPLETO" ? "INCOMPLETO" : "ENCERROU";
        }
        const usuarioJson = funcionario.toJSON();
        delete usuarioJson.salario;
        delete usuarioJson.valorDiaria;
        return { usuario: usuarioJson, status, dia, ultima };
      });

      res.json({ hoje, funcionarios: lista, locais: await locaisAtivos(), agora: new Date() });
    } catch (error) {
      console.error("Erro ao carregar painel do ponto:", error);
      res.status(500).json({ error: "Erro ao carregar o painel do ponto" });
    }
  },

  // Todas as batidas com filtros
  async listarBatidas(req, res) {
    try {
      const { inicio, fim } = lerPeriodo(req.query);
      const where = { dataHora: { [Op.between]: [inicioDoDia(inicio), fimDoDia(fim)] } };
      if (req.query.usuarioId) where.usuarioId = req.query.usuarioId;
      if (req.query.localId) where.localPontoId = req.query.localId;
      if (req.query.tipo && TIPOS_PONTO.includes(req.query.tipo)) where.tipo = req.query.tipo;
      if (req.query.situacao === "FORA") where.foraDoLocal = true;
      if (req.query.situacao === "AJUSTE") where.origem = "AJUSTE";
      if (req.query.situacao === "DESCONSIDERADA") where.desconsiderada = true;
      else if (req.query.situacao !== "TODAS") where.desconsiderada = false;

      const registros = await RegistroPonto.findAll({
        where,
        include: [...incluirDetalhes, { model: Usuario, as: "usuario", attributes: ["id", "nome", "role"] }],
        order: [["dataHora", "DESC"]],
        limit: 2000,
      });
      res.json({ periodo: { inicio, fim }, batidas: registros.map(formatar) });
    } catch (error) {
      console.error("Erro ao listar batidas:", error);
      res.status(500).json({ error: "Erro ao listar as batidas" });
    }
  },

  // Espelho de ponto: dia a dia de um funcionário
  async espelho(req, res) {
    try {
      const usuario = await Usuario.findByPk(req.query.usuarioId, { attributes: ATRIBUTOS_USUARIO });
      if (!usuario) return res.status(404).json({ error: "Funcionário não encontrado" });
      const { inicio, fim } = lerPeriodo(req.query);
      res.json({ usuario, periodo: { inicio, fim }, ...(await espelhoDoUsuario(usuario, inicio, fim)) });
    } catch (error) {
      console.error("Erro ao montar espelho de ponto:", error);
      res.status(500).json({ error: "Erro ao montar o espelho de ponto" });
    }
  },

  // Totais do período por funcionário
  async resumo(req, res) {
    try {
      const { inicio, fim } = lerPeriodo(req.query);
      const funcionarios = await funcionariosComPonto();
      const feriados = await carregarFeriados(inicio, fim);
      const batidas = (
        await RegistroPonto.findAll({
          where: {
            desconsiderada: false,
            dataReferencia: { [Op.between]: [somarDias(inicio, -3), fim] },
          },
          order: [["dataHora", "ASC"]],
        })
      ).map(formatar);
      const porUsuario = new Map();
      for (const batida of batidas) {
        if (!porUsuario.has(batida.usuarioId)) porUsuario.set(batida.usuarioId, []);
        porUsuario.get(batida.usuarioId).push(batida);
      }
      const linhas = funcionarios.map((funcionario) => ({
        usuario: funcionario.toJSON(),
        totais: montarEspelho({
          inicio,
          fim,
          batidas: porUsuario.get(funcionario.id) || [],
          jornadaMinutos: funcionario.jornadaDiariaMinutos ?? 480,
          config: configDe(funcionario),
          feriados,
        }).totais,
      }));
      res.json({ periodo: { inicio, fim }, funcionarios: linhas });
    } catch (error) {
      console.error("Erro ao montar resumo do ponto:", error);
      res.status(500).json({ error: "Erro ao montar o resumo do ponto" });
    }
  },

  // Lançar batida esquecida/errada (fica marcada como ajuste, com motivo)
  async ajustar(req, res) {
    try {
      const { usuarioId, tipo, dataHora, motivo } = req.body;
      if (!TIPOS_PONTO.includes(tipo)) return res.status(400).json({ error: "Tipo de batida inválido." });
      if (!motivo || String(motivo).trim().length < 3) {
        return res.status(400).json({ error: "Informe o motivo do ajuste." });
      }
      const momento = new Date(dataHora);
      if (!Number.isFinite(momento.getTime())) return res.status(400).json({ error: "Data e hora inválidas." });
      if (momento > new Date()) return res.status(400).json({ error: "Não dá para lançar batida no futuro." });
      const usuario = await Usuario.findByPk(usuarioId);
      if (!usuario || PERFIS_SEM_PONTO.includes(usuario.role)) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      const dataReferencia = DIA_VALIDO.test(req.body.dataReferencia || "")
        ? req.body.dataReferencia
        : diaEmBrasilia(momento);

      const registro = await RegistroPonto.create({
        usuarioId,
        tipo,
        dataHora: momento,
        dataReferencia,
        origem: "AJUSTE",
        criadoPorId: req.usuario.id,
        motivoAjuste: String(motivo).trim().slice(0, 255),
        foraDoLocal: false,
      });
      res.status(201).json(formatar(await RegistroPonto.findByPk(registro.id, { include: incluirDetalhes })));
    } catch (error) {
      console.error("Erro ao ajustar ponto:", error);
      res.status(500).json({ error: "Erro ao lançar o ajuste" });
    }
  },

  // Tirar uma batida da conta (continua no histórico)
  async desconsiderar(req, res) {
    try {
      const { motivo } = req.body;
      if (!motivo || String(motivo).trim().length < 3) {
        return res.status(400).json({ error: "Informe o motivo." });
      }
      const registro = await RegistroPonto.findByPk(req.params.id);
      if (!registro) return res.status(404).json({ error: "Batida não encontrada" });
      if (registro.desconsiderada) return res.status(400).json({ error: "Essa batida já foi desconsiderada." });
      await registro.update({
        desconsiderada: true,
        desconsideradaPorId: req.usuario.id,
        desconsideradaEm: new Date(),
        motivoDesconsiderada: String(motivo).trim().slice(0, 255),
      });
      res.json(formatar(await RegistroPonto.findByPk(registro.id, { include: incluirDetalhes })));
    } catch (error) {
      console.error("Erro ao desconsiderar batida:", error);
      res.status(500).json({ error: "Erro ao desconsiderar a batida" });
    }
  },

  async listarLocais(req, res) {
    try {
      const locais = await LocalPonto.findAll({
        include: [{ model: Loja, as: "loja", attributes: ["id", "nome"] }],
        order: [["ativo", "DESC"], ["nome", "ASC"]],
      });
      res.json(locais.map(formatarLocal));
    } catch (error) {
      console.error("Erro ao listar locais de ponto:", error);
      res.status(500).json({ error: "Erro ao listar os locais" });
    }
  },

  async salvarLocal(req, res) {
    try {
      const nome = String(req.body.nome || "").trim();
      const latitude = numero(req.body.latitude);
      const longitude = numero(req.body.longitude);
      const raioMetros = Math.round(numero(req.body.raioMetros) ?? 200);
      if (!nome) return res.status(400).json({ error: "Informe o nome do local." });
      if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return res.status(400).json({ error: "Marque o local no mapa." });
      }
      if (raioMetros < 20 || raioMetros > 5000) {
        return res.status(400).json({ error: "O raio precisa ficar entre 20 e 5000 metros." });
      }
      const dados = {
        nome: nome.slice(0, 100),
        lojaId: req.body.lojaId || null,
        latitude,
        longitude,
        raioMetros,
        ativo: req.body.ativo !== false,
      };
      let local;
      if (req.params.id) {
        local = await LocalPonto.findByPk(req.params.id);
        if (!local) return res.status(404).json({ error: "Local não encontrado" });
        await local.update(dados);
      } else {
        local = await LocalPonto.create(dados);
      }
      res.status(req.params.id ? 200 : 201).json(formatarLocal(local));
    } catch (error) {
      console.error("Erro ao salvar local de ponto:", error);
      res.status(500).json({ error: "Erro ao salvar o local" });
    }
  },

  // Batidas antigas guardam o local: aqui só desativa
  async desativarLocal(req, res) {
    try {
      const local = await LocalPonto.findByPk(req.params.id);
      if (!local) return res.status(404).json({ error: "Local não encontrado" });
      await local.update({ ativo: false });
      res.json(formatarLocal(local));
    } catch (error) {
      console.error("Erro ao desativar local de ponto:", error);
      res.status(500).json({ error: "Erro ao desativar o local" });
    }
  },

  // Aba Extras: por funcionário, os dias com hora extra (50% / 100%) e o valor;
  // o dia pode ser pago como diária no lugar da hora extra
  async extras(req, res) {
    try {
      const { inicio, fim } = lerPeriodo(req.query);
      const [funcionarios, feriados, decisoes] = await Promise.all([
        funcionariosComPonto(),
        carregarFeriados(inicio, fim),
        PontoExtraDia.findAll({ where: { dia: { [Op.between]: [inicio, fim] } }, raw: true }),
      ]);
      const batidas = (
        await RegistroPonto.findAll({
          where: { desconsiderada: false, dataReferencia: { [Op.between]: [somarDias(inicio, -3), fim] } },
          order: [["dataHora", "ASC"]],
        })
      ).map(formatar);
      const porUsuario = new Map();
      for (const batida of batidas) {
        if (!porUsuario.has(batida.usuarioId)) porUsuario.set(batida.usuarioId, []);
        porUsuario.get(batida.usuarioId).push(batida);
      }
      const decisaoDe = new Map(decisoes.map((d) => [`${d.usuarioId}:${d.dia}`, d]));

      const linhas = funcionarios
        .map((funcionario) => {
          const config = configDe(funcionario);
          const espelho = montarEspelho({
            inicio,
            fim,
            batidas: porUsuario.get(funcionario.id) || [],
            jornadaMinutos: funcionario.jornadaDiariaMinutos ?? 480,
            config,
            feriados,
          });
          const dias = espelho.dias
            .filter((d) => d.extraMinutos > 0 || decisaoDe.has(`${funcionario.id}:${d.dia}`))
            .map((d) => {
              const decisao = decisaoDe.get(`${funcionario.id}:${d.dia}`);
              const valorHoraExtra = valorDasExtras(config, d.extra50Minutos, d.extra100Minutos);
              return {
                dia: d.dia,
                diaDaSemana: d.diaDaSemana,
                tipoDia: d.tipoDia,
                feriadoNome: d.feriadoNome,
                trabalhadoMinutos: d.trabalhadoMinutos,
                jornadaMinutos: d.jornadaMinutos,
                extra50Minutos: d.extra50Minutos,
                extra100Minutos: d.extra100Minutos,
                intervaloDescontadoMinutos: d.intervaloDescontadoMinutos,
                valorHoraExtra,
                forma: decisao ? "DIARIA" : "HORA_EXTRA",
                valorDiaria: decisao ? Number(decisao.valor) : valorDaDiaria(config),
                observacao: decisao?.observacao || null,
                valor: decisao ? Number(decisao.valor) : valorHoraExtra,
              };
            });
          const total = (campo) => dias.reduce((soma, d) => soma + d[campo], 0);
          return {
            usuario: {
              id: funcionario.id,
              nome: funcionario.nome,
              role: funcionario.role,
              escala: config.escala,
              salario: funcionario.salario === null ? null : Number(funcionario.salario),
              valorHora: Number(valorDaHora(config).toFixed(2)),
              valorDiaria: valorDaDiaria(config),
            },
            dias,
            totais: {
              extra50Minutos: total("extra50Minutos"),
              extra100Minutos: total("extra100Minutos"),
              diasComDiaria: dias.filter((d) => d.forma === "DIARIA").length,
              valorHoraExtra: Number(dias.filter((d) => d.forma === "HORA_EXTRA").reduce((s, d) => s + d.valor, 0).toFixed(2)),
              valorDiarias: Number(dias.filter((d) => d.forma === "DIARIA").reduce((s, d) => s + d.valor, 0).toFixed(2)),
              valor: Number(total("valor").toFixed(2)),
            },
          };
        })
        .filter((linha) => linha.dias.length > 0);
      res.json({ periodo: { inicio, fim }, funcionarios: linhas });
    } catch (error) {
      console.error("Erro ao montar extras do ponto:", error);
      res.status(500).json({ error: "Erro ao montar as horas extras" });
    }
  },

  // Dia pago como diária (forma DIARIA, com valor) ou de volta para hora extra
  async salvarExtraDia(req, res) {
    try {
      const { usuarioId, dia, forma, observacao } = req.body;
      if (!DIA_VALIDO.test(dia || "")) return res.status(400).json({ error: "Dia inválido." });
      const usuario = await Usuario.findByPk(usuarioId, { attributes: ATRIBUTOS_USUARIO });
      if (!usuario || PERFIS_SEM_PONTO.includes(usuario.role)) return res.status(404).json({ error: "Funcionário não encontrado" });
      if (forma === "HORA_EXTRA") {
        await PontoExtraDia.destroy({ where: { usuarioId, dia } });
        return res.json({ ok: true, forma: "HORA_EXTRA" });
      }
      if (forma !== "DIARIA") return res.status(400).json({ error: "Escolha hora extra ou diária." });
      const valor = req.body.valor === undefined || req.body.valor === "" ? valorDaDiaria(configDe(usuario)) : Number(String(req.body.valor).replace(",", "."));
      if (!Number.isFinite(valor) || valor < 0) return res.status(400).json({ error: "Valor da diária inválido." });
      const dados = {
        usuarioId,
        dia,
        forma: "DIARIA",
        valor: Number(valor.toFixed(2)),
        observacao: observacao ? String(observacao).trim().slice(0, 255) : null,
        criadoPorId: req.usuario.id,
      };
      const existente = await PontoExtraDia.findOne({ where: { usuarioId, dia } });
      const registro = existente ? await existente.update(dados) : await PontoExtraDia.create(dados);
      res.json(registro);
    } catch (error) {
      console.error("Erro ao salvar diária:", error);
      res.status(500).json({ error: "Erro ao salvar" });
    }
  },

  // Alertas: quem está trabalhando e já passou da jornada do dia (ou está
  // trabalhando na folga/feriado)
  async alertas(req, res) {
    try {
      const hoje = diaEmBrasilia();
      const ontem = somarDias(hoje, -1);
      const [funcionarios, feriados, batidas] = await Promise.all([
        funcionariosComPonto(),
        carregarFeriados(ontem, hoje),
        RegistroPonto.findAll({
          where: { desconsiderada: false, dataReferencia: { [Op.between]: [somarDias(hoje, -2), hoje] } },
          order: [["dataHora", "ASC"]],
        }).then((lista) => lista.map(formatar)),
      ]);
      const porUsuario = new Map();
      for (const batida of batidas) {
        if (!porUsuario.has(batida.usuarioId)) porUsuario.set(batida.usuarioId, []);
        porUsuario.get(batida.usuarioId).push(batida);
      }
      const alertas = [];
      for (const funcionario of funcionarios) {
        const lista = porUsuario.get(funcionario.id);
        if (!lista) continue;
        const espelho = montarEspelho({
          inicio: ontem,
          fim: hoje,
          batidas: lista,
          jornadaMinutos: funcionario.jornadaDiariaMinutos ?? 480,
          config: configDe(funcionario),
          feriados,
        });
        const dia = espelho.dias.find((d) => d.situacao === "EM_ANDAMENTO");
        if (!dia) continue;
        if (dia.passouDaJornadaMinutos > 0) {
          alertas.push({
            usuario: { id: funcionario.id, nome: funcionario.nome },
            tipo: dia.tipoDia === "TRABALHO" ? "PASSOU_DA_JORNADA" : "TRABALHANDO_NA_FOLGA",
            minutos: dia.passouDaJornadaMinutos,
            trabalhadoMinutos: dia.trabalhadoMinutos,
            jornadaMinutos: dia.jornadaMinutos,
            tipoDia: dia.tipoDia,
          });
        }
      }
      res.json({ alertas });
    } catch (error) {
      console.error("Erro ao carregar alertas do ponto:", error);
      res.status(500).json({ error: "Erro ao carregar os alertas do ponto" });
    }
  },

  async salvarJornada(req, res) {
    try {
      const minutos = Math.round(numero(req.body.jornadaDiariaMinutos) ?? -1);
      if (minutos < 60 || minutos > 720) {
        return res.status(400).json({ error: "A jornada precisa ficar entre 1h e 12h por dia." });
      }
      const usuario = await Usuario.findByPk(req.params.usuarioId);
      if (!usuario) return res.status(404).json({ error: "Funcionário não encontrado" });
      await usuario.update({ jornadaDiariaMinutos: minutos });
      res.json({ id: usuario.id, nome: usuario.nome, jornadaDiariaMinutos: minutos });
    } catch (error) {
      console.error("Erro ao salvar jornada:", error);
      res.status(500).json({ error: "Erro ao salvar a jornada" });
    }
  },
};

export default pontoController;
