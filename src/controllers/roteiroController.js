import { Op } from "sequelize";
import {
  Loja,
  Maquina,
  Roteiro,
  RoteiroItem,
  Usuario,
  Veiculo,
} from "../models/index.js";

const includeRoteiro = [
  {
    model: Usuario,
    as: "funcionario",
    attributes: ["id", "nome", "email", "role"],
  },
  {
    model: Veiculo,
    as: "veiculo",
    attributes: ["id", "nome", "modelo", "tipo", "emoji"],
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
  ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(req.usuario.role) ||
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

export const listarRoteiros = async (req, res) => {
  try {
    await aplicarResetSeNecessario();

    const where =
      ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(req.usuario.role)
        ? {}
        : { usuarioId: req.usuario.id, ativo: true };

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
    const { nome, usuarioId, veiculoId, todosDias = true, diasSemana = [] } = req.body;
    const configReset = normalizarResetsAgendados(req.body);

    if (!nome || !usuarioId) {
      return res.status(400).json({ error: "Nome e funcionário são obrigatórios" });
    }

    const funcionario = await Usuario.findByPk(usuarioId);
    if (!funcionario || funcionario.role !== "FUNCIONARIO") {
      return res.status(400).json({ error: "Funcionário inválido" });
    }

    if (veiculoId) {
      const veiculo = await Veiculo.findByPk(veiculoId);
      if (!veiculo) return res.status(400).json({ error: "Veículo inválido" });
    }

    const roteiro = await Roteiro.create({
      nome: nome.trim(),
      usuarioId,
      veiculoId: veiculoId || null,
      todosDias: Boolean(todosDias),
      diasSemana: normalizarDiasSemana(Boolean(todosDias), diasSemana),
      ...configReset,
    });

    res.locals.entityId = roteiro.id;
    res.status(201).json(await obterRoteiroCompleto(roteiro.id));
  } catch (error) {
    if (
      error.message === "Dia de reset invalido" ||
      error.message === "Horario de reset invalido" ||
      error.message === "Informe ao menos um dia e horário de reset"
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao criar roteiro:", error);
    res.status(500).json({ error: "Erro ao criar roteiro" });
  }
};

export const atualizarRoteiro = async (req, res) => {
  try {
    const roteiro = await Roteiro.findByPk(req.params.id);
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });

    const { nome, usuarioId, veiculoId, todosDias, diasSemana, ativo } = req.body;
    const todosDiasFinal = todosDias !== undefined ? Boolean(todosDias) : roteiro.todosDias;
    const configReset = normalizarResetsAgendados(req.body, roteiro);

    await roteiro.update({
      nome: nome !== undefined ? String(nome).trim() : roteiro.nome,
      usuarioId: usuarioId ?? roteiro.usuarioId,
      veiculoId: veiculoId === "" ? null : veiculoId ?? roteiro.veiculoId,
      todosDias: todosDiasFinal,
      diasSemana:
        diasSemana !== undefined
          ? normalizarDiasSemana(todosDiasFinal, diasSemana)
          : roteiro.diasSemana,
      ...configReset,
      ativo: ativo ?? roteiro.ativo,
    });

    res.json(await obterRoteiroCompleto(roteiro.id));
  } catch (error) {
    if (
      error.message === "Dia de reset invalido" ||
      error.message === "Horario de reset invalido" ||
      error.message === "Informe ao menos um dia e horário de reset"
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Erro ao atualizar roteiro:", error);
    res.status(500).json({ error: "Erro ao atualizar roteiro" });
  }
};

export const excluirRoteiro = async (req, res) => {
  try {
    const roteiro = await Roteiro.findByPk(req.params.id);
    if (!roteiro) return res.status(404).json({ error: "Roteiro não encontrado" });

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
