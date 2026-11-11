import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  ProjetoLoja,
  ProjetoLojaMaquina,
  ProjetoLojaCusto,
  ProjetoLojaMidia,
  ProjetoLojaMaquinaHistorico,
  Loja,
  Maquina,
  Usuario,
  TransferenciaMaquina,
  GastoFixoLoja,
  GastoTotalFixoLoja,
  ExtintorLoja,
} from "../models/index.js";
import { ehLojaDeProjetoEmImplantacao } from "../utils/lojaProjeto.js";
import {
  STATUS_PROJETO_FECHADO,
  sincronizarMaquinasDoProjeto,
} from "../services/projetoLojaMaquinas.js";

const MAX_MIDIAS_PROJETO = 7;

const includeProjeto = [
  {
    model: Loja,
    as: "loja",
    attributes: ["id", "nome", "statusOperacao", "ativo"],
  },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  {
    model: ProjetoLojaMaquina,
    as: "maquinas",
    include: [
      {
        model: Maquina,
        as: "maquina",
        attributes: ["id", "codigo", "nome", "lojaId"],
      },
    ],
  },
  { model: ProjetoLojaCusto, as: "custos" },
  { model: ProjetoLojaMidia, as: "midias" },
  {
    model: ProjetoLojaMaquinaHistorico,
    as: "historicoMaquinas",
    include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome"] }],
  },
];

const ordemFilhos = [
  [{ model: ProjetoLojaMidia, as: "midias" }, "ordem", "ASC"],
  [{ model: ProjetoLojaMaquinaHistorico, as: "historicoMaquinas" }, "createdAt", "ASC"],
];

const buscarProjetoCompleto = (id) =>
  ProjetoLoja.findByPk(id, { include: includeProjeto, order: ordemFilhos });

const dataHojeLocal = () => {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
};

const erroValidacao = (mensagem) => {
  const erro = new Error(mensagem);
  erro.status = 400;
  return erro;
};

const normalizarValor = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
};

const normalizarMaquinas = (maquinas) => {
  if (!Array.isArray(maquinas)) return [];

  return maquinas
    .map((item) => ({
      nome: String(item?.nome || "").trim(),
      maquinaId: item?.maquinaId || null,
      tipo: item?.maquinaId ? null : item?.tipo ? String(item.tipo).trim() : null,
      quantidade: item?.maquinaId ? 1 : Math.max(1, parseInt(item?.quantidade, 10) || 1),
      custoUnitario: normalizarValor(item?.custoUnitario),
      observacao: item?.observacao ? String(item.observacao).trim() : null,
    }))
    .filter((item) => item.nome.length > 0)
    .map((item) => ({
      ...item,
      custoTotal: Number((item.quantidade * item.custoUnitario).toFixed(2)),
    }));
};

const normalizarCustos = (custos) => {
  if (!Array.isArray(custos)) return [];

  return custos
    .map((item) => ({
      categoria: String(item?.categoria || "").trim(),
      descricao: item?.descricao ? String(item.descricao).trim() : null,
      valor: normalizarValor(item?.valor),
    }))
    .filter((item) => item.categoria.length > 0);
};

const normalizarMidias = (midias) => {
  if (!Array.isArray(midias)) return [];

  const urls = midias
    .map((item) => String((typeof item === "string" ? item : item?.url) || "").trim())
    .filter((url) => url.length > 0);

  if (urls.length > MAX_MIDIAS_PROJETO) {
    throw erroValidacao(`O projeto aceita no máximo ${MAX_MIDIAS_PROJETO} fotos.`);
  }

  return urls.map((url, ordem) => ({ url, ordem }));
};

// Reservas (máquinas adicionadas à mão) só podem vir do depósito (sem loja),
// e a mesma máquina não pode estar reservada em dois projetos abertos.
// Máquina que já está na própria loja do projeto não é reserva: ela entra
// sozinha como origem LOJA na sincronização, então sai da lista devolvida.
const validarMaquinasDoDeposito = async (
  maquinas,
  projetoIdAtual,
  lojaIdProjeto,
  transaction,
) => {
  const idsInformados = maquinas.map((item) => item.maquinaId).filter(Boolean);
  const ids = [...new Set(idsInformados)];
  if (ids.length === 0) return maquinas;

  if (ids.length !== idsInformados.length) {
    throw erroValidacao("A mesma máquina foi adicionada mais de uma vez.");
  }

  const encontradas = await Maquina.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "codigo", "nome", "lojaId"],
    transaction,
  });

  const idsJaNaLoja = new Set(
    encontradas
      .filter((m) => lojaIdProjeto && m.lojaId === lojaIdProjeto)
      .map((m) => m.id),
  );

  for (const id of ids) {
    const maquina = encontradas.find((m) => m.id === id);
    if (!maquina) {
      throw erroValidacao("Uma das máquinas selecionadas não existe mais.");
    }
    if (maquina.lojaId && !idsJaNaLoja.has(id)) {
      throw erroValidacao(
        `A máquina ${maquina.codigo || maquina.nome} não está no depósito. Só máquinas sem loja podem entrar no projeto.`,
      );
    }
  }

  const idsReservados = ids.filter((id) => !idsJaNaLoja.has(id));
  if (idsReservados.length > 0) {
    const emOutroProjeto = await ProjetoLojaMaquina.findOne({
      where: {
        maquinaId: { [Op.in]: idsReservados },
        origem: "RESERVA",
        ...(projetoIdAtual ? { projetoLojaId: { [Op.ne]: projetoIdAtual } } : {}),
      },
      include: [
        {
          model: ProjetoLoja,
          as: "projeto",
          attributes: ["id", "nome"],
          where: { status: { [Op.notIn]: STATUS_PROJETO_FECHADO } },
        },
      ],
      transaction,
    });

    if (emOutroProjeto) {
      throw erroValidacao(
        `A máquina ${emOutroProjeto.nome} já está reservada no projeto "${emOutroProjeto.projeto.nome}".`,
      );
    }
  }

  return maquinas.filter((item) => !idsJaNaLoja.has(item.maquinaId));
};

const validarLoja = async (lojaId, transaction) => {
  if (!lojaId) return;
  const loja = await Loja.findByPk(lojaId, { attributes: ["id"], transaction });
  if (!loja) throw erroValidacao("Loja vinculada não encontrada.");
};

const salvarMidias = async (projetoId, midias, transaction) => {
  await ProjetoLojaMidia.destroy({
    where: { projetoLojaId: projetoId },
    transaction,
  });
  if (midias.length > 0) {
    await ProjetoLojaMidia.bulkCreate(
      midias.map((item) => ({ ...item, projetoLojaId: projetoId })),
      { transaction },
    );
  }
};

// Só as reservas são substituídas pelo que vem da tela; as linhas de origem
// LOJA são cuidadas pela sincronização.
const salvarReservas = async (projetoId, maquinas, transaction) => {
  await ProjetoLojaMaquina.destroy({
    where: { projetoLojaId: projetoId, origem: "RESERVA" },
    transaction,
  });
  if (maquinas.length > 0) {
    await ProjetoLojaMaquina.bulkCreate(
      maquinas.map((item) => ({
        ...item,
        origem: "RESERVA",
        projetoLojaId: projetoId,
      })),
      { transaction },
    );
  }
};

const calcularTotalInvestido = (projeto) => {
  const totalMaquinas = (projeto.maquinas || []).reduce(
    (acc, item) => acc + Number(item.custoTotal || 0),
    0,
  );
  const totalCustos = (projeto.custos || []).reduce(
    (acc, item) => acc + Number(item.valor || 0),
    0,
  );
  return Number((totalMaquinas + totalCustos).toFixed(2));
};

const projetoComTotal = (projeto) => {
  const dados = projeto.toJSON ? projeto.toJSON() : projeto;
  return { ...dados, totalInvestido: calcularTotalInvestido(dados) };
};

// Rede de segurança: além da sincronização feita na hora da transferência,
// confere de novo ao abrir o projeto (pega mudanças feitas por outros caminhos).
const sincronizarSeAberto = async (projeto) => {
  if (STATUS_PROJETO_FECHADO.includes(projeto.status)) return;
  await sequelize.transaction((transaction) =>
    sincronizarMaquinasDoProjeto(projeto.id, { transaction }),
  );
};

const MENSAGEM_USE_CONCLUIR =
  'Para concluir, salve o projeto e use o botão "Marcar como concluída".';

const projetoLojaController = {
  async listar(req, res) {
    try {
      const abertos = await ProjetoLoja.findAll({
        where: { status: { [Op.notIn]: STATUS_PROJETO_FECHADO } },
        attributes: ["id", "status"],
      });
      for (const projeto of abertos) {
        await sincronizarSeAberto(projeto);
      }

      const projetos = await ProjetoLoja.findAll({
        include: includeProjeto,
        order: [["createdAt", "DESC"], ...ordemFilhos],
      });

      return res.json(projetos.map(projetoComTotal));
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao listar projetos de loja",
        details: err.message,
      });
    }
  },

  async obter(req, res) {
    try {
      const existente = await ProjetoLoja.findByPk(req.params.id, {
        attributes: ["id", "status"],
      });

      if (!existente) {
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      await sincronizarSeAberto(existente);
      const projeto = await buscarProjetoCompleto(existente.id);
      return res.json(projetoComTotal(projeto));
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao buscar projeto de loja",
        details: err.message,
      });
    }
  },

  async criar(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const {
        nome,
        lojaId,
        status,
        dataPrevisaoAbertura,
        observacoes,
        maquinas,
        custos,
        midias,
      } = req.body;

      if (!nome || !String(nome).trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: "Informe o nome do projeto." });
      }

      if (status === "CONCLUIDO") {
        await transaction.rollback();
        return res.status(400).json({ error: MENSAGEM_USE_CONCLUIR });
      }

      const midiasNormalizadas = normalizarMidias(midias);
      await validarLoja(lojaId, transaction);
      const reservas = await validarMaquinasDoDeposito(
        normalizarMaquinas(maquinas),
        null,
        lojaId || null,
        transaction,
      );

      const projeto = await ProjetoLoja.create(
        {
          nome: String(nome).trim(),
          lojaId: lojaId || null,
          status: status || "PLANEJAMENTO",
          dataPrevisaoAbertura: dataPrevisaoAbertura || null,
          observacoes: observacoes || null,
          criadoPorId: req.usuario.id,
        },
        { transaction },
      );

      await salvarReservas(projeto.id, reservas, transaction);

      const custosNormalizados = normalizarCustos(custos);
      if (custosNormalizados.length > 0) {
        await ProjetoLojaCusto.bulkCreate(
          custosNormalizados.map((item) => ({
            ...item,
            projetoLojaId: projeto.id,
          })),
          { transaction },
        );
      }

      await salvarMidias(projeto.id, midiasNormalizadas, transaction);
      await sincronizarMaquinasDoProjeto(projeto.id, { transaction, aoVincularLoja: true });

      await transaction.commit();

      const projetoCompleto = await buscarProjetoCompleto(projeto.id);
      return res.status(201).json(projetoComTotal(projetoCompleto));
    } catch (err) {
      await transaction.rollback();
      if (err.status === 400) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({
        error: "Erro ao criar projeto de loja",
        details: err.message,
      });
    }
  },

  async atualizar(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const projeto = await ProjetoLoja.findByPk(req.params.id, { transaction });
      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      const {
        nome,
        lojaId,
        status,
        dataPrevisaoAbertura,
        observacoes,
        maquinas,
        custos,
        midias,
      } = req.body;

      if (!nome || !String(nome).trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: "Informe o nome do projeto." });
      }

      // Depois de concluído, a loja e as máquinas ficam congeladas como foram
      // registradas: só nome, custos, fotos e observações mudam por aqui.
      const jaConcluido = projeto.status === "CONCLUIDO";

      if (!jaConcluido && status === "CONCLUIDO") {
        await transaction.rollback();
        return res.status(400).json({ error: MENSAGEM_USE_CONCLUIR });
      }

      const midiasNormalizadas = normalizarMidias(midias);
      const lojaIdFinal = jaConcluido ? projeto.lojaId : lojaId || null;
      let reservas = [];
      if (!jaConcluido) {
        await validarLoja(lojaIdFinal, transaction);
        reservas = await validarMaquinasDoDeposito(
          normalizarMaquinas(maquinas),
          projeto.id,
          lojaIdFinal,
          transaction,
        );
      }

      // Trocou a loja do projeto: as máquinas da loja antiga deixam de valer
      const lojaTrocada = !jaConcluido && lojaIdFinal !== projeto.lojaId;
      if (lojaTrocada) {
        await ProjetoLojaMaquina.destroy({
          where: { projetoLojaId: projeto.id, origem: "LOJA" },
          transaction,
        });
        if (projeto.lojaId) {
          const lojaAntiga = await Loja.findByPk(projeto.lojaId, {
            attributes: ["nome"],
            transaction,
          });
          await ProjetoLojaMaquinaHistorico.create(
            {
              projetoLojaId: projeto.id,
              tipo: "INFO",
              detalhe: `Loja do projeto trocada (antes: ${lojaAntiga?.nome || "outra loja"}). As máquinas da loja antiga saíram do projeto.`,
              data: dataHojeLocal(),
              usuarioId: req.usuario.id,
            },
            { transaction },
          );
        }
      }

      await projeto.update(
        {
          nome: String(nome).trim(),
          lojaId: lojaIdFinal,
          status: jaConcluido ? projeto.status : status || projeto.status,
          dataPrevisaoAbertura: dataPrevisaoAbertura || null,
          observacoes: observacoes || null,
        },
        { transaction },
      );

      if (!jaConcluido) {
        await salvarReservas(projeto.id, reservas, transaction);
      }

      await ProjetoLojaCusto.destroy({
        where: { projetoLojaId: projeto.id },
        transaction,
      });
      const custosNormalizados = normalizarCustos(custos);
      if (custosNormalizados.length > 0) {
        await ProjetoLojaCusto.bulkCreate(
          custosNormalizados.map((item) => ({
            ...item,
            projetoLojaId: projeto.id,
          })),
          { transaction },
        );
      }

      await salvarMidias(projeto.id, midiasNormalizadas, transaction);
      await sincronizarMaquinasDoProjeto(projeto.id, {
        transaction,
        aoVincularLoja: lojaTrocada,
      });

      await transaction.commit();

      const projetoCompleto = await buscarProjetoCompleto(projeto.id);
      return res.json(projetoComTotal(projetoCompleto));
    } catch (err) {
      await transaction.rollback();
      if (err.status === 400) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(500).json({
        error: "Erro ao atualizar projeto de loja",
        details: err.message,
      });
    }
  },

  // Loja nova vira loja real (ATIVA), as reservas do depósito vão pra loja
  // (com registro de transferência) e a lista final de máquinas fica gravada
  // e congelada no projeto.
  async concluir(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const projeto = await ProjetoLoja.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ error: "Projeto não encontrado" });
      }
      if (projeto.status === "CONCLUIDO") {
        await transaction.rollback();
        return res.status(400).json({ error: "Este projeto já foi concluído." });
      }
      if (projeto.status === "CANCELADO") {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Projeto cancelado não pode ser concluído." });
      }
      if (!projeto.lojaId) {
        await transaction.rollback();
        return res.status(400).json({
          error:
            "Escolha uma loja existente ou cadastre a loja nova antes de concluir.",
        });
      }

      const loja = await Loja.findByPk(projeto.lojaId, { transaction });
      if (!loja) {
        await transaction.rollback();
        return res.status(400).json({ error: "Loja vinculada não encontrada." });
      }

      const hoje = dataHojeLocal();

      if (ehLojaDeProjetoEmImplantacao(loja)) {
        await loja.update(
          {
            statusOperacao: "ATIVA",
            ativo: true,
            dataInicio: loja.dataInicio || hoje,
          },
          { transaction },
        );
      }

      const reservas = await ProjetoLojaMaquina.findAll({
        where: {
          projetoLojaId: projeto.id,
          origem: "RESERVA",
          maquinaId: { [Op.ne]: null },
        },
        transaction,
      });

      for (const item of reservas) {
        const maquina = await Maquina.findByPk(item.maquinaId, { transaction });
        if (!maquina || maquina.lojaId === loja.id) continue;

        if (maquina.lojaId) {
          await transaction.rollback();
          return res.status(400).json({
            error: `A máquina ${maquina.codigo || maquina.nome} saiu do depósito e está em outra loja. Remova-a do projeto ou traga de volta antes de concluir.`,
          });
        }

        await maquina.update(
          { lojaId: loja.id, statusOperacao: "EM_OPERACAO", motivoParada: null },
          { transaction },
        );

        await TransferenciaMaquina.create(
          {
            maquinaId: maquina.id,
            lojaOrigemId: null,
            lojaDestinoId: loja.id,
            dataTransferencia: hoje,
            usuarioId: req.usuario.id,
            observacao: `Projeto Loja "${projeto.nome}" concluído`,
          },
          { transaction },
        );
      }

      // Grava a foto final das máquinas da loja antes de congelar
      await sincronizarMaquinasDoProjeto(projeto.id, { transaction });
      await ProjetoLojaMaquinaHistorico.create(
        {
          projetoLojaId: projeto.id,
          tipo: "INFO",
          detalhe: "Projeto concluído: lista de máquinas congelada.",
          data: hoje,
          usuarioId: req.usuario.id,
        },
        { transaction },
      );

      await projeto.update({ status: "CONCLUIDO" }, { transaction });
      await transaction.commit();

      const projetoCompleto = await buscarProjetoCompleto(projeto.id);
      return res.json(projetoComTotal(projetoCompleto));
    } catch (err) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Erro ao concluir projeto de loja",
        details: err.message,
      });
    }
  },

  async excluir(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const projeto = await ProjetoLoja.findByPk(req.params.id, { transaction });
      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      // A loja nova que ainda não virou real só existia pra esse projeto:
      // apaga junto, com os gastos fixos e extintores cadastrados nela.
      const loja = projeto.lojaId
        ? await Loja.findByPk(projeto.lojaId, { transaction })
        : null;

      await ProjetoLojaMidia.destroy({
        where: { projetoLojaId: projeto.id },
        transaction,
      });
      await ProjetoLojaMaquinaHistorico.destroy({
        where: { projetoLojaId: projeto.id },
        transaction,
      });
      await projeto.destroy({ transaction });

      if (ehLojaDeProjetoEmImplantacao(loja)) {
        await GastoFixoLoja.destroy({ where: { lojaId: loja.id }, transaction });
        await GastoTotalFixoLoja.destroy({
          where: { lojaId: loja.id },
          transaction,
        });
        await ExtintorLoja.destroy({ where: { lojaId: loja.id }, transaction });
        await loja.destroy({ transaction });
      }

      await transaction.commit();
      return res.status(204).send();
    } catch (err) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Erro ao excluir projeto de loja",
        details: err.message,
      });
    }
  },
};

export default projetoLojaController;
