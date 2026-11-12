import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  Envio,
  Lacre,
  Loja,
  Maquina,
  MovimentacaoVeiculo,
  Roteiro,
  RoteiroItem,
  Usuario,
  Veiculo,
} from "../models/index.js";
import { temAcao } from "../permissoes/acessos.js";

const includeRoteiro = [
  {
    model: Usuario,
    as: "funcionario",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Veiculo,
    as: "veiculo",
    attributes: ["id", "nome", "modelo", "tipo", "emoji", "km", "emUso"],
  },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  {
    model: Envio,
    as: "envios",
    attributes: ["id", "lojaDestinoId", "despachadoEm", "observacao"],
    include: [{ model: Lacre, as: "lacres", attributes: ["id", "numero", "status"] }],
  },
  {
    model: RoteiroItem,
    as: "itens",
    include: [
      {
        model: Loja,
        as: "loja",
        attributes: ["id", "nome", "endereco", "cidade", "estado"],
      },
    ],
  },
];

const ordenarItens = (roteiro) => {
  const json = roteiro.toJSON();
  json.itens = (json.itens || []).sort((a, b) => a.ordem - b.ordem);
  return json;
};

const obterRoteiroCompleto = async (id) => {
  const roteiro = await Roteiro.findByPk(id, { include: includeRoteiro });
  return roteiro ? ordenarItens(roteiro) : null;
};

const usuarioPodeAcessar = (req, roteiro) =>
  temAcao(req.usuario, "roteiros.verTodos") ||
  String(roteiro.usuarioId) === String(req.usuario.id);

const normalizarDiasSemana = (todosDias, diasSemana) => {
  if (todosDias) return [];
  if (!Array.isArray(diasSemana)) return [];
  return diasSemana
    .map((dia) => Number.parseInt(dia, 10))
    .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6);
};

const DEFAULT_RESETS_AGENDADOS = [{ diaSemana: 0, hora: "23:59" }];

const montarUltimoHorarioAgendadoPar = (diaSemana, hora, agora) => {
  const [horaParte, minuto] = String(hora || "23:59")
    .split(":")
    .map((parte) => Number.parseInt(parte, 10));
  const data = new Date(agora);
  const diferencaDias = (data.getDay() - Number(diaSemana || 0) + 7) % 7;

  data.setDate(data.getDate() - diferencaDias);
  data.setHours(Number.isFinite(horaParte) ? horaParte : 23);
  data.setMinutes(Number.isFinite(minuto) ? minuto : 59);
  data.setSeconds(0);
  data.setMilliseconds(0);

  if (data > agora) {
    data.setDate(data.getDate() - 7);
  }

  return data;
};

const montarUltimoHorarioAgendado = (roteiro, agora = new Date()) => {
  const pares =
    Array.isArray(roteiro.resetsAgendados) && roteiro.resetsAgendados.length > 0
      ? roteiro.resetsAgendados
      : DEFAULT_RESETS_AGENDADOS;

  return pares
    .map((par) => montarUltimoHorarioAgendadoPar(par.diaSemana, par.hora, agora))
    .reduce((maisRecente, data) => (data > maisRecente ? data : maisRecente));
};

const aplicarResetSeNecessario = async () => {
  const roteiros = await Roteiro.findAll({
    attributes: ["id", "resetsAgendados", "ultimoResetEm"],
  });

  for (const roteiro of roteiros) {
    const ultimoAgendado = montarUltimoHorarioAgendado(roteiro);
    const ultimoReset = roteiro.ultimoResetEm ? new Date(roteiro.ultimoResetEm) : null;

    if (!ultimoReset || ultimoReset < ultimoAgendado) {
      await RoteiroItem.update(
        { concluido: false, concluidoEm: null, maquinasConcluidas: [] },
        { where: { roteiroId: roteiro.id } },
      );
      await roteiro.update({ ultimoResetEm: ultimoAgendado });
    }
  }
};

// ---------- Rotas do motorista ----------

// Início: rota passa a EM_ANDAMENTO e o veículo fica em uso (indisponível),
// com registro de retirada no histórico do veículo
const iniciarRota = async (rota, usuarioId, automatico, transaction) => {
  const dados = { status: "EM_ANDAMENTO", iniciadaEm: new Date() };
  if (rota.veiculoId) {
    const veiculo = await Veiculo.findByPk(rota.veiculoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (veiculo) {
      dados.kmInicial = veiculo.km;
      await veiculo.update({ emUso: true }, { transaction });
      await MovimentacaoVeiculo.create(
        {
          veiculoId: veiculo.id,
          usuarioId,
          tipo: "retirada",
          dataHora: new Date(),
          gasolina: veiculo.nivelCombustivel,
          nivel_limpeza: veiculo.nivelLimpeza,
          estado: veiculo.estado,
          modo: veiculo.modo,
          km: veiculo.km,
          obs: `Rota "${rota.nome}" ${automatico ? "(início automático no horário)" : "(iniciada pelo motorista)"}`,
        },
        { transaction },
      );
    }
  }
  await rota.update(dados, { transaction });
};

// Roda a cada minuto (server.js) e antes de listar: rotas agendadas cujo
// horário chegou começam sozinhas
export const sincronizarRotas = async () => {
  const vencidas = await Roteiro.findAll({
    where: { status: "AGENDADA", dataInicio: { [Op.ne]: null, [Op.lte]: new Date() } },
  });
  for (const rota of vencidas) {
    try {
      await sequelize.transaction(async (transaction) => {
        const atual = await Roteiro.findByPk(rota.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (atual?.status === "AGENDADA") await iniciarRota(atual, atual.usuarioId, true, transaction);
      });
    } catch (error) {
      console.error("Erro ao iniciar rota automaticamente:", rota.id, error.message);
    }
  }
};

let sincronizacaoAgendada = false;
export const agendarSincronizacaoDeRotas = () => {
  if (sincronizacaoAgendada) return;
  sincronizacaoAgendada = true;
  setInterval(() => sincronizarRotas().catch(() => {}), 60 * 1000);
};

// Motorista e veículo não podem estar em duas rotas abertas no mesmo dia
const conflitoDeRota = async ({ id, usuarioId, veiculoId, dataInicio }) => {
  if (!dataInicio) return null;
  const dia = new Date(new Date(dataInicio).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
  const inicioDia = new Date(`${dia}T00:00:00-03:00`);
  const fimDia = new Date(`${dia}T23:59:59-03:00`);
  const abertas = await Roteiro.findAll({
    where: {
      ...(id ? { id: { [Op.ne]: id } } : {}),
      status: { [Op.in]: ["AGENDADA", "EM_ANDAMENTO"] },
      [Op.or]: [
        { status: "EM_ANDAMENTO" },
        { dataInicio: { [Op.between]: [inicioDia, fimDia] } },
      ],
    },
    attributes: ["id", "nome", "usuarioId", "veiculoId", "status"],
  });
  const doVeiculo = veiculoId && abertas.find((r) => r.veiculoId === veiculoId);
  if (doVeiculo) return `O veículo já está na rota "${doVeiculo.nome}" nesse dia.`;
  const doMotorista = abertas.find((r) => r.usuarioId === usuarioId);
  if (doMotorista) return `O motorista já tem a rota "${doMotorista.nome}" nesse dia.`;
  return null;
};

const dadosDaRota = async (body, rotaAtual = null) => {
  const nome = String(body.nome ?? rotaAtual?.nome ?? "").trim();
  const usuarioId = body.usuarioId ?? rotaAtual?.usuarioId;
  const veiculoId = body.veiculoId === "" ? null : body.veiculoId ?? rotaAtual?.veiculoId ?? null;
  const dataInicio = body.dataInicio !== undefined ? (body.dataInicio ? new Date(body.dataInicio) : null) : rotaAtual?.dataInicio;
  if (!nome) return { erro: "Dê um nome para a rota." };
  if (!usuarioId) return { erro: "Escolha o motorista." };
  if (!dataInicio || Number.isNaN(new Date(dataInicio).getTime())) return { erro: "Informe a data e a hora de início." };
  const motorista = await Usuario.findByPk(usuarioId, { attributes: ["id", "role", "ativo"] });
  if (!motorista || !motorista.ativo || motorista.role !== "MOTORISTA") return { erro: "Escolha um motorista ativo." };
  if (veiculoId && !(await Veiculo.findByPk(veiculoId))) return { erro: "Veículo inválido." };
  const conflito = await conflitoDeRota({ id: rotaAtual?.id, usuarioId, veiculoId, dataInicio });
  if (conflito) return { erro: conflito };
  return { dados: { nome, usuarioId, veiculoId, dataInicio } };
};

// Lojas, motoristas, veículos e envios sem rota, para montar a rota
export const opcoesRota = async (req, res) => {
  try {
    const [lojas, motoristas, veiculos, envios] = await Promise.all([
      Loja.findAll({ where: { ativo: true }, attributes: ["id", "nome", "cidade"], order: [["nome", "ASC"]] }),
      Usuario.findAll({ where: { ativo: true, role: "MOTORISTA" }, attributes: ["id", "nome"], order: [["nome", "ASC"]] }),
      Veiculo.findAll({ attributes: ["id", "nome", "modelo", "tipo", "emoji", "emUso", "parada", "km"], order: [["nome", "ASC"]] }),
      Envio.findAll({
        where: { roteiroId: null },
        attributes: ["id", "lojaDestinoId", "despachadoEm", "createdAt"],
        include: [
          { model: Loja, as: "lojaDestino", attributes: ["id", "nome"] },
          { model: Lacre, as: "lacres", attributes: ["id", "numero", "status"] },
        ],
        order: [["createdAt", "DESC"]],
        limit: 100,
      }),
    ]);
    res.json({
      lojas: lojas.filter((l) => !["deposito principal", "depósito principal"].includes(String(l.nome).trim().toLowerCase())),
      motoristas,
      veiculos,
      // Só os que ainda não foram conferidos na loja
      envios: envios.filter((e) => (e.lacres || []).some((l) => ["SEPARADO", "EM_TRANSITO"].includes(l.status))),
    });
  } catch (error) {
    console.error("Erro ao carregar opções da rota:", error);
    res.status(500).json({ error: "Erro ao carregar opções da rota" });
  }
};

// Motorista (ou gestão) começa antes do horário
export const iniciarRotaManual = async (req, res) => {
  try {
    const resultado = await sequelize.transaction(async (transaction) => {
      const rota = await Roteiro.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!rota) return { status: 404, erro: "Rota não encontrada" };
      if (!usuarioPodeAcessar(req, rota)) return { status: 403, erro: "Essa rota não é sua." };
      if (rota.status !== "AGENDADA") return { status: 409, erro: "Essa rota já começou." };
      await iniciarRota(rota, rota.usuarioId, false, transaction);
      return { id: rota.id };
    });
    if (resultado.erro) return res.status(resultado.status).json({ error: resultado.erro });
    res.json(await obterRoteiroCompleto(resultado.id));
  } catch (error) {
    console.error("Erro ao iniciar rota:", error);
    res.status(500).json({ error: "Erro ao iniciar a rota" });
  }
};

// Motorista finaliza: data fim automática, devolve o veículo (KM final)
export const finalizarRota = async (req, res) => {
  try {
    const resultado = await sequelize.transaction(async (transaction) => {
      const rota = await Roteiro.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!rota) return { status: 404, erro: "Rota não encontrada" };
      if (!usuarioPodeAcessar(req, rota)) return { status: 403, erro: "Essa rota não é sua." };
      if (rota.status === "FINALIZADA") return { status: 409, erro: "Essa rota já foi finalizada." };
      const agora = new Date();
      const dados = { status: "FINALIZADA", dataFim: agora, iniciadaEm: rota.iniciadaEm || agora };
      if (rota.veiculoId) {
        const veiculo = await Veiculo.findByPk(rota.veiculoId, { transaction, lock: transaction.LOCK.UPDATE });
        if (veiculo) {
          const km = Math.floor(Number(req.body?.km));
          if (!Number.isFinite(km)) return { status: 400, erro: "Informe a quilometragem final do veículo." };
          if (km < Number(veiculo.km)) return { status: 400, erro: `A quilometragem não pode ser menor que ${veiculo.km}.` };
          dados.kmFinal = km;
          await veiculo.update(
            {
              emUso: false,
              km,
              ...(req.body?.combustivel ? { nivelCombustivel: req.body.combustivel } : {}),
            },
            { transaction },
          );
          await MovimentacaoVeiculo.create(
            {
              veiculoId: veiculo.id,
              usuarioId: req.usuario.id,
              tipo: "devolucao",
              dataHora: agora,
              gasolina: req.body?.combustivel || veiculo.nivelCombustivel,
              nivel_limpeza: veiculo.nivelLimpeza,
              estado: veiculo.estado,
              modo: veiculo.modo,
              km,
              obs: `Fim da rota "${rota.nome}"${req.body?.observacao ? ` — ${String(req.body.observacao).slice(0, 200)}` : ""}`,
            },
            { transaction },
          );
        }
      }
      await rota.update(dados, { transaction });
      return { id: rota.id };
    });
    if (resultado.erro) return res.status(resultado.status).json({ error: resultado.erro });
    res.json(await obterRoteiroCompleto(resultado.id));
  } catch (error) {
    console.error("Erro ao finalizar rota:", error);
    res.status(500).json({ error: "Erro ao finalizar a rota" });
  }
};

export const listarRoteiros = async (req, res) => {
  try {
    await sincronizarRotas();

    // Motorista vê as rotas dele (finalizadas só dos últimos 7 dias)
    const where = temAcao(req.usuario, "roteiros.verTodos")
      ? {}
      : {
          usuarioId: req.usuario.id,
          ativo: true,
          [Op.or]: [
            { status: { [Op.ne]: "FINALIZADA" } },
            { dataFim: { [Op.gte]: new Date(Date.now() - 7 * 24 * 3600e3) } },
          ],
        };

    const roteiros = await Roteiro.findAll({
      where,
      include: includeRoteiro,
      order: [
        ["createdAt", "DESC"],
        [{ model: RoteiroItem, as: "itens" }, "ordem", "ASC"],
      ],
    });

    res.json(roteiros.map(ordenarItens));
  } catch (error) {
    console.error("Erro ao listar roteiros:", error);
    res.status(500).json({ error: "Erro ao listar roteiros" });
  }
};

const normalizarResetsAgendados = (body, roteiro = {}) => {
  const lista =
    body.resetsAgendados !== undefined
      ? body.resetsAgendados
      : roteiro.resetsAgendados ?? DEFAULT_RESETS_AGENDADOS;

  if (!Array.isArray(lista) || lista.length === 0) {
    throw new Error("Informe ao menos um dia e horário de reset");
  }

  const resetsAgendados = lista.map((par) => {
    const diaSemana = Number.parseInt(par?.diaSemana, 10);
    const hora = String(par?.hora || "").trim();

    if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
      throw new Error("Dia de reset invalido");
    }

    if (!/^\d{2}:\d{2}$/.test(hora)) {
      throw new Error("Horario de reset invalido");
    }

    return { diaSemana, hora };
  });

  return { resetsAgendados };
};

export const criarRoteiro = async (req, res) => {
  try {
    const { dados, erro } = await dadosDaRota(req.body);
    if (erro) return res.status(400).json({ error: erro });
    const roteiro = await Roteiro.create({
      ...dados,
      status: "AGENDADA",
      criadoPorId: req.usuario.id,
      todosDias: true,
      diasSemana: [],
    });
    // Paradas já na criação: [lojaId, ...] na ordem
    const paradas = Array.isArray(req.body.paradas) ? req.body.paradas.filter(Boolean) : [];
    if (paradas.length) {
      await RoteiroItem.bulkCreate(
        paradas.map((lojaId, ordem) => ({ roteiroId: roteiro.id, tipo: "LOJA", lojaId, ordem })),
      );
    }
    res.locals.entityId = roteiro.id;
    res.status(201).json(await obterRoteiroCompleto(roteiro.id));
  } catch (error) {
    console.error("Erro ao criar rota:", error);
    res.status(500).json({ error: "Erro ao criar a rota" });
  }
};

export const atualizarRoteiro = async (req, res) => {
  try {
    const roteiro = await Roteiro.findByPk(req.params.id);
    if (!roteiro) return res.status(404).json({ error: "Rota não encontrada" });
    if (roteiro.status === "FINALIZADA") return res.status(400).json({ error: "Rota finalizada não pode ser editada." });
    const { dados, erro } = await dadosDaRota(req.body, roteiro);
    if (erro) return res.status(400).json({ error: erro });
    if (roteiro.status === "EM_ANDAMENTO") {
      // Em andamento: só nome (motorista, veículo e início já valeram)
      await roteiro.update({ nome: dados.nome });
    } else {
      await roteiro.update({ ...dados, ativo: req.body.ativo ?? roteiro.ativo });
    }
    res.json(await obterRoteiroCompleto(roteiro.id));
  } catch (error) {
    console.error("Erro ao atualizar rota:", error);
    res.status(500).json({ error: "Erro ao atualizar a rota" });
  }
};

export const excluirRoteiro = async (req, res) => {
  try {
    const roteiro = await Roteiro.findByPk(req.params.id);
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });
    if (roteiro.status === "EM_ANDAMENTO") {
      return res.status(400).json({ error: "A rota está em andamento: o motorista precisa finalizar." });
    }

    // Envios dessa rota voltam a ficar sem rota
    await Envio.update({ roteiroId: null }, { where: { roteiroId: roteiro.id } });
    await roteiro.destroy();
    res.json({ message: "Roteiro removido com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir roteiro:", error);
    res.status(500).json({ error: "Erro ao excluir roteiro" });
  }
};

export const criarItemRoteiro = async (req, res) => {
  try {
    const { roteiroId } = req.params;
    const { tipo, lojaId, anotacao, ordem } = req.body;
    const roteiro = await Roteiro.findByPk(roteiroId);

    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });
    if (!usuarioPodeAcessar(req, roteiro)) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    const tipoFinal = tipo === "ANOTACAO" ? "ANOTACAO" : "LOJA";
    if (tipoFinal === "LOJA" && !lojaId) {
      return res.status(400).json({ error: "Selecione uma loja" });
    }
    if (tipoFinal === "ANOTACAO" && !String(anotacao || "").trim()) {
      return res.status(400).json({ error: "Informe a anotação" });
    }

    const totalItens = await RoteiroItem.count({ where: { roteiroId } });
    const item = await RoteiroItem.create({
      roteiroId,
      tipo: tipoFinal,
      lojaId: tipoFinal === "LOJA" ? lojaId : null,
      anotacao: tipoFinal === "ANOTACAO" ? String(anotacao).trim() : anotacao || null,
      ordem: ordem ?? totalItens,
    });

    res.locals.entityId = item.id;
    res.status(201).json(await obterRoteiroCompleto(roteiroId));
  } catch (error) {
    console.error("Erro ao criar item do roteiro:", error);
    res.status(500).json({ error: "Erro ao criar item do roteiro" });
  }
};

export const atualizarItemRoteiro = async (req, res) => {
  try {
    const item = await RoteiroItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    const roteirosIds = [item.roteiroId, req.body.roteiroId].filter(Boolean);
    const roteiros = await Roteiro.findAll({ where: { id: { [Op.in]: roteirosIds } } });
    if (roteiros.some((roteiro) => !usuarioPodeAcessar(req, roteiro))) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    await item.update({
      roteiroId: req.body.roteiroId ?? item.roteiroId,
      ordem: req.body.ordem ?? item.ordem,
      lojaId: req.body.lojaId !== undefined ? req.body.lojaId : item.lojaId,
      anotacao:
        req.body.anotacao !== undefined ? String(req.body.anotacao).trim() : item.anotacao,
    });

    res.json(await obterRoteiroCompleto(item.roteiroId));
  } catch (error) {
    console.error("Erro ao atualizar item do roteiro:", error);
    res.status(500).json({ error: "Erro ao atualizar item do roteiro" });
  }
};

export const excluirItemRoteiro = async (req, res) => {
  try {
    const item = await RoteiroItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    const roteiroId = item.roteiroId;
    const roteiro = await Roteiro.findByPk(roteiroId);
    if (!usuarioPodeAcessar(req, roteiro)) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    await item.destroy();
    res.json(await obterRoteiroCompleto(roteiroId));
  } catch (error) {
    console.error("Erro ao excluir item do roteiro:", error);
    res.status(500).json({ error: "Erro ao excluir item do roteiro" });
  }
};

export const concluirItemRoteiro = async (req, res) => {
  try {
    const item = await RoteiroItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    const roteiro = await Roteiro.findByPk(item.roteiroId);
    if (!roteiro || !usuarioPodeAcessar(req, roteiro)) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    const concluido = req.body.concluido !== false;
    await item.update({
      concluido,
      concluidoEm: concluido ? new Date() : null,
      maquinasConcluidas: concluido ? item.maquinasConcluidas : [],
    });

    res.json(await obterRoteiroCompleto(item.roteiroId));
  } catch (error) {
    console.error("Erro ao concluir item do roteiro:", error);
    res.status(500).json({ error: "Erro ao concluir item do roteiro" });
  }
};

export const concluirMaquinaRoteiro = async (req, res) => {
  try {
    const item = await RoteiroItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ error: "Item não encontrado" });

    const roteiro = await Roteiro.findByPk(item.roteiroId);
    if (!roteiro || !usuarioPodeAcessar(req, roteiro)) {
      return res.status(403).json({ error: "Acesso negado ao roteiro" });
    }

    if (item.tipo !== "LOJA" || !item.lojaId) {
      return res.status(400).json({ error: "Este item não é uma loja do roteiro" });
    }

    const { maquinaId } = req.params;
    const { movimentacaoId } = req.body;
    const maquina = await Maquina.findOne({
      where: { id: maquinaId, lojaId: item.lojaId },
    });
    if (!maquina) {
      return res
        .status(400)
        .json({ error: "Máquina não pertence à loja deste roteiro" });
    }

    // maquinasConcluidas guarda { maquinaId, movimentacaoId } por máquina,
    // pra saber exatamente qual movimentação resultou da conclusão (caso a
    // mesma máquina apareça de novo no roteiro, "a última movimentação da
    // máquina" pegaria a errada). Registros antigos (só o id em texto) ainda
    // são aceitos e migrados de forma transparente aqui.
    const listaAtual = Array.isArray(item.maquinasConcluidas)
      ? item.maquinasConcluidas
      : [];
    const mapaConcluidas = new Map(
      listaAtual.map((registro) =>
        typeof registro === "string"
          ? [registro, null]
          : [String(registro.maquinaId), registro.movimentacaoId ?? null],
      ),
    );
    mapaConcluidas.set(
      String(maquinaId),
      movimentacaoId ? String(movimentacaoId) : null,
    );

    const maquinasDaLoja = await Maquina.findAll({
      where: { lojaId: item.lojaId },
      attributes: ["id"],
    });
    const lojaConcluida =
      maquinasDaLoja.length > 0 &&
      maquinasDaLoja.every((maquinaLoja) =>
        mapaConcluidas.has(String(maquinaLoja.id)),
      );

    await item.update({
      maquinasConcluidas: [...mapaConcluidas.entries()].map(
        ([maquinaId, movimentacaoId]) => ({ maquinaId, movimentacaoId }),
      ),
      concluido: lojaConcluida,
      concluidoEm: lojaConcluida ? new Date() : null,
    });

    res.json(await obterRoteiroCompleto(item.roteiroId));
  } catch (error) {
    console.error("Erro ao concluir máquina do roteiro:", error);
    res.status(500).json({ error: "Erro ao concluir máquina do roteiro" });
  }
};
