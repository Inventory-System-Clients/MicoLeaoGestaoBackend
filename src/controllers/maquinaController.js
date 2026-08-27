import {
  Maquina,
  Loja,
  Movimentacao,
  TransferenciaMaquina,
  Usuario,
} from "../models/index.js";
import { sequelize } from "../database/connection.js";

const normalizarLojaId = (lojaId) => (lojaId ? lojaId : null);

const normalizarDatasAuditoria = (datas) => {
  if (!Array.isArray(datas)) return [];
  const validas = datas
    .map((data) => String(data || "").trim())
    .filter((data) => /^\d{4}-\d{2}-\d{2}$/.test(data));
  return [...new Set(validas)].sort();
};

export const normalizarStatusOperacao = ({ lojaId, statusOperacao }) => {
  const status = statusOperacao || (lojaId ? "EM_OPERACAO" : "PARADA");
  if (!lojaId && status === "EM_OPERACAO") return "PARADA";
  if (status === "EM_TRANSPORTE") return "PARADA";
  return status;
};

// Só mantém motivo quando a máquina está de fato PARADA; some junto com o status.
const normalizarMotivoParada = ({ statusOperacao, motivoParada }) => {
  if (statusOperacao !== "PARADA") return null;
  const motivo = String(motivoParada || "").trim();
  return motivo || null;
};

// Trocadora não tem produto (usa "Ficha") nem jogadas por pelúcia; categoria/telemetria
// só existem quando a máquina de fato gera receita.
const normalizarCamposGeradora = ({
  geradoraReceita,
  categoriaGeradora,
  telemetria,
  nome,
  jogadasBoasPorPelucia,
}) => {
  if (!geradoraReceita) {
    return {
      categoriaGeradora: null,
      telemetria: null,
      nome,
      jogadasBoasPorPelucia,
    };
  }

  const categoria = String(categoriaGeradora || "").toUpperCase();

  if (categoria === "TROCADORA") {
    return {
      categoriaGeradora: "TROCADORA",
      telemetria: null,
      nome: nome || "Ficha",
      jogadasBoasPorPelucia: null,
    };
  }

  return {
    categoriaGeradora: "MAQUINA",
    telemetria: String(telemetria || "").trim() || null,
    nome,
    jogadasBoasPorPelucia,
  };
};

// US05 - Listar máquinas
export const listarMaquinas = async (req, res) => {
  try {
    const { lojaId, incluirInativas } = req.query;
    const where = {};

    if (lojaId) {
      where.lojaId = lojaId;
    }

    // Por padrão, só mostra máquinas ativas
    // Para ver inativas, passar ?incluirInativas=true
    if (incluirInativas !== "true") {
      where.ativo = true;
    }

    const maquinas = await Maquina.findAll({
      where,
      attributes: { exclude: [] }, // Inclui todos os atributos da máquina, inclusive lojaId
      include: [
        {
          model: Loja,
          as: "loja",
          attributes: ["id", "nome", "cidade"],
        },
      ],
      order: [["codigo", "ASC"]],
    });

    res.json(maquinas);
  } catch (error) {
    console.error("Erro ao listar máquinas:", error);
    res.status(500).json({ error: "Erro ao listar máquinas" });
  }
};

// US05 - Obter máquina por ID
export const obterMaquina = async (req, res) => {
  try {
    const maquina = await Maquina.findByPk(req.params.id, {
      attributes: { exclude: [] }, // Inclui todos os atributos, inclusive lojaId
      include: [
        {
          model: Loja,
          as: "loja",
        },
      ],
    });

    if (!maquina) {
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    res.json(maquina);
  } catch (error) {
    console.error("Erro ao obter máquina:", error);
    res.status(500).json({ error: "Erro ao obter máquina" });
  }
};

// US05 - Criar máquina
export const criarMaquina = async (req, res) => {
  try {
    const {
      codigo,
      nome,
      tipo,
      lojaId,
      statusOperacao,
      motivoParada,
      capacidadePadrao,
      custoAquisicao,
      valorFicha,
      valorJogada,
      fichasNecessarias,
      jogadasBoasPorPelucia,
      forcaForte,
      forcaFraca,
      forcaPremium,
      jogadasPremium,
      percentualAlertaEstoque,
      localizacao,
      datasAuditoria,
      auditoria,
      geradoraReceita,
      categoriaGeradora,
      telemetria,
    } = req.body;

    if (!codigo) {
      return res.status(400).json({ error: "Codigo da maquina e obrigatorio" });
    }

    // Verificar se código já existe
    const maquinaExistente = await Maquina.findOne({ where: { codigo } });
    if (maquinaExistente) {
      return res.status(400).json({ error: "Código de máquina já existe" });
    }

    const lojaNormalizada = normalizarLojaId(lojaId);
    const statusFinal = normalizarStatusOperacao({
      lojaId: lojaNormalizada,
      statusOperacao,
    });

    const geradoraReceitaFinal = geradoraReceita === undefined ? true : Boolean(geradoraReceita);
    const camposGeradora = normalizarCamposGeradora({
      geradoraReceita: geradoraReceitaFinal,
      categoriaGeradora,
      telemetria,
      nome,
      jogadasBoasPorPelucia: jogadasBoasPorPelucia || null,
    });

    if (
      geradoraReceitaFinal &&
      camposGeradora.categoriaGeradora === "TROCADORA" &&
      !(valorFicha > 0)
    ) {
      return res.status(400).json({ error: "Informe o valor da ficha para a trocadora" });
    }

    if (
      geradoraReceitaFinal &&
      camposGeradora.categoriaGeradora === "MAQUINA" &&
      !(valorJogada > 0)
    ) {
      return res.status(400).json({ error: "Informe o valor da jogada para a máquina" });
    }

    // Máquina (categoria MAQUINA) não tem ficha própria: o sistema se baseia no
    // contador IN das coletas usando o valor da jogada, então zera valorFicha em
    // vez de cair no default de 5. Trocadora não usa valor da jogada.
    const valorFichaFinal =
      camposGeradora.categoriaGeradora === "MAQUINA" ? 0 : valorFicha || 5.0;
    const valorJogadaFinal =
      camposGeradora.categoriaGeradora === "MAQUINA" ? valorJogada || null : null;

    const maquina = await Maquina.create({
      codigo,
      nome: camposGeradora.nome,
      tipo,
      lojaId: lojaNormalizada,
      statusOperacao: statusFinal,
      motivoParada: normalizarMotivoParada({
        statusOperacao: statusFinal,
        motivoParada,
      }),
      capacidadePadrao: capacidadePadrao || 100,
      custoAquisicao:
        custoAquisicao !== undefined && custoAquisicao !== null && custoAquisicao !== ""
          ? custoAquisicao
          : null,
      geradoraReceita: geradoraReceitaFinal,
      categoriaGeradora: camposGeradora.categoriaGeradora,
      telemetria: camposGeradora.telemetria,
      valorFicha: valorFichaFinal,
      valorJogada: valorJogadaFinal,
      fichasNecessarias: fichasNecessarias || null,
      jogadasBoasPorPelucia: camposGeradora.jogadasBoasPorPelucia,
      forcaForte: forcaForte || null,
      forcaFraca: forcaFraca || null,
      forcaPremium: forcaPremium || null,
      jogadasPremium: jogadasPremium || null,
      percentualAlertaEstoque: percentualAlertaEstoque || 30,
      localizacao,
      datasAuditoria: normalizarDatasAuditoria(datasAuditoria),
      auditoria: Boolean(auditoria),
    });

    res.locals.entityId = maquina.id;
    res.status(201).json(maquina);
  } catch (error) {
    console.error("Erro ao criar máquina:", error);
    res.status(500).json({ error: "Erro ao criar máquina" });
  }
};

// US05 - Atualizar máquina
export const atualizarMaquina = async (req, res) => {
  try {
    const maquina = await Maquina.findByPk(req.params.id);

    if (!maquina) {
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    const {
      codigo,
      nome,
      tipo,
      lojaId,
      statusOperacao,
      motivoParada,
      capacidadePadrao,
      custoAquisicao,
      valorFicha,
      valorJogada,
      fichasNecessarias,
      jogadasBoasPorPelucia,
      forcaForte,
      forcaFraca,
      forcaPremium,
      jogadasPremium,
      percentualAlertaEstoque,
      localizacao,
      ativo,
      datasAuditoria,
      auditoria,
      geradoraReceita,
      categoriaGeradora,
      telemetria,
    } = req.body;

    // Verificar se novo código já existe em outra máquina
    if (codigo && codigo !== maquina.codigo) {
      const maquinaExistente = await Maquina.findOne({ where: { codigo } });
      if (maquinaExistente) {
        return res.status(400).json({ error: "Código de máquina já existe" });
      }
    }

    const lojaNormalizada =
      lojaId !== undefined ? normalizarLojaId(lojaId) : maquina.lojaId;
    const statusFinal = normalizarStatusOperacao({
      lojaId: lojaNormalizada,
      statusOperacao: statusOperacao ?? maquina.statusOperacao,
    });

    const geradoraReceitaFinal =
      geradoraReceita !== undefined ? Boolean(geradoraReceita) : maquina.geradoraReceita;
    const camposGeradora = normalizarCamposGeradora({
      geradoraReceita: geradoraReceitaFinal,
      categoriaGeradora:
        categoriaGeradora !== undefined ? categoriaGeradora : maquina.categoriaGeradora,
      telemetria: telemetria !== undefined ? telemetria : maquina.telemetria,
      nome: nome !== undefined ? nome : maquina.nome,
      jogadasBoasPorPelucia:
        jogadasBoasPorPelucia !== undefined
          ? jogadasBoasPorPelucia
          : maquina.jogadasBoasPorPelucia,
    });

    if (
      geradoraReceitaFinal &&
      camposGeradora.categoriaGeradora === "TROCADORA" &&
      !((valorFicha ?? maquina.valorFicha) > 0)
    ) {
      return res.status(400).json({ error: "Informe o valor da ficha para a trocadora" });
    }

    if (
      geradoraReceitaFinal &&
      camposGeradora.categoriaGeradora === "MAQUINA" &&
      !((valorJogada ?? maquina.valorJogada) > 0)
    ) {
      return res.status(400).json({ error: "Informe o valor da jogada para a máquina" });
    }

    // Máquina (categoria MAQUINA) não tem ficha própria: o sistema se baseia no
    // contador IN das coletas usando o valor da jogada, então zera valorFicha em
    // vez de manter valor antigo. Trocadora não usa valor da jogada.
    const valorFichaFinal =
      camposGeradora.categoriaGeradora === "MAQUINA"
        ? 0
        : valorFicha ?? maquina.valorFicha;
    const valorJogadaFinal =
      camposGeradora.categoriaGeradora === "MAQUINA"
        ? valorJogada ?? maquina.valorJogada
        : null;

    await maquina.update({
      codigo: codigo ?? maquina.codigo,
      nome: camposGeradora.nome,
      tipo: tipo ?? maquina.tipo,
      lojaId: lojaNormalizada,
      statusOperacao: statusFinal,
      motivoParada: normalizarMotivoParada({
        statusOperacao: statusFinal,
        motivoParada: motivoParada !== undefined ? motivoParada : maquina.motivoParada,
      }),
      capacidadePadrao: capacidadePadrao ?? maquina.capacidadePadrao,
      custoAquisicao:
        custoAquisicao !== undefined
          ? custoAquisicao === "" ? null : custoAquisicao
          : maquina.custoAquisicao,
      geradoraReceita: geradoraReceitaFinal,
      categoriaGeradora: camposGeradora.categoriaGeradora,
      telemetria: camposGeradora.telemetria,
      valorFicha: valorFichaFinal,
      valorJogada: valorJogadaFinal,
      fichasNecessarias:
        fichasNecessarias !== undefined ? fichasNecessarias : maquina.fichasNecessarias,
      jogadasBoasPorPelucia: camposGeradora.jogadasBoasPorPelucia,
      forcaForte: forcaForte ?? maquina.forcaForte,
      forcaFraca: forcaFraca ?? maquina.forcaFraca,
      forcaPremium: forcaPremium ?? maquina.forcaPremium,
      jogadasPremium: jogadasPremium ?? maquina.jogadasPremium,
      percentualAlertaEstoque:
        percentualAlertaEstoque ?? maquina.percentualAlertaEstoque,
      localizacao: localizacao ?? maquina.localizacao,
      ativo: ativo ?? maquina.ativo,
      datasAuditoria:
        datasAuditoria !== undefined
          ? normalizarDatasAuditoria(datasAuditoria)
          : maquina.datasAuditoria,
      auditoria: auditoria !== undefined ? Boolean(auditoria) : maquina.auditoria,
    });

    res.json(maquina);
  } catch (error) {
    console.error("Erro ao atualizar máquina:", error);
    res.status(500).json({ error: "Erro ao atualizar máquina" });
  }
};

// US05 - Deletar máquina (soft delete na 1ª vez, hard delete na 2ª)
export const deletarMaquina = async (req, res) => {
  try {
    const maquina = await Maquina.findByPk(req.params.id);

    if (!maquina) {
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    // Se já está inativa, deletar permanentemente
    if (!maquina.ativo) {
      await maquina.destroy();
      res.locals.entityId = req.params.id;
      return res.json({
        message: "Máquina excluída permanentemente com sucesso",
        permanentDelete: true,
      });
    }

    // Se está ativa, apenas desativar (soft delete)
    await maquina.update({ ativo: false });
    res.locals.entityId = maquina.id;
    res.json({
      message:
        "Máquina desativada com sucesso. Clique novamente para excluir permanentemente.",
      permanentDelete: false,
    });
  } catch (error) {
    console.error("Erro ao deletar máquina:", error);
    res.status(500).json({ error: "Erro ao deletar máquina" });
  }
};

// US07 - Obter estoque atual da máquina
export const obterEstoqueAtual = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🔍 [obterEstoqueAtual] Buscando estoque para máquina:", id);

    const maquina = await Maquina.findByPk(id);

    if (!maquina) {
      console.log("❌ [obterEstoqueAtual] Máquina não encontrada:", id);
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    // Buscar última movimentação
    const ultimaMovimentacao = await Movimentacao.findOne({
      where: { maquinaId: maquina.id },
      order: [["dataColeta", "DESC"]],
    });

    console.log("📦 [obterEstoqueAtual] Última movimentação:", {
      id: ultimaMovimentacao?.id,
      dataColeta: ultimaMovimentacao?.dataColeta,
      totalPre: ultimaMovimentacao?.totalPre,
      sairam: ultimaMovimentacao?.sairam,
      abastecidas: ultimaMovimentacao?.abastecidas,
      totalPos: ultimaMovimentacao?.totalPos,
    });

    const estoqueAtual = ultimaMovimentacao ? ultimaMovimentacao.totalPos : 0;
    const percentualEstoque = (estoqueAtual / maquina.capacidadePadrao) * 100;
    const estoqueMinimo =
      (maquina.capacidadePadrao * maquina.percentualAlertaEstoque) / 100;

    console.log("✅ [obterEstoqueAtual] Estoque calculado:", {
      estoqueAtual,
      percentualEstoque: percentualEstoque.toFixed(2),
      estoqueMinimo,
      alertaEstoqueBaixo: estoqueAtual < estoqueMinimo,
    });

    res.json({
      maquina: {
        id: maquina.id,
        codigo: maquina.codigo,
        nome: maquina.nome,
        capacidadePadrao: maquina.capacidadePadrao,
      },
      estoqueAtual,
      percentualEstoque: percentualEstoque.toFixed(2),
      estoqueMinimo,
      alertaEstoqueBaixo: estoqueAtual < estoqueMinimo,
      ultimaAtualizacao: ultimaMovimentacao?.dataColeta,
    });
  } catch (error) {
    console.error("❌ [obterEstoqueAtual] Erro ao obter estoque:", error);
    res.status(500).json({ error: "Erro ao obter estoque" });
  }
};

// Transferir máquina para outra loja (ou para o galpão) sem criar um novo cadastro
export const transferirMaquina = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { lojaDestinoId, dataTransferencia, observacao } = req.body;

    const maquina = await Maquina.findByPk(id, { transaction });
    if (!maquina) {
      await transaction.rollback();
      return res.status(404).json({ error: "Máquina não encontrada" });
    }

    if (!dataTransferencia || !/^\d{4}-\d{2}-\d{2}$/.test(dataTransferencia)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe a data da transferência" });
    }

    const lojaDestinoNormalizada = lojaDestinoId || null;

    if (lojaDestinoNormalizada) {
      const lojaDestino = await Loja.findByPk(lojaDestinoNormalizada, {
        transaction,
      });
      if (!lojaDestino) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ error: "Loja de destino não encontrada" });
      }
    }

    const lojaOrigemId = maquina.lojaId || null;

    if (lojaOrigemId === lojaDestinoNormalizada) {
      await transaction.rollback();
      return res.status(400).json({
        error: lojaDestinoNormalizada
          ? "A máquina já está nessa loja"
          : "A máquina já está no galpão",
      });
    }

    const statusFinal = lojaDestinoNormalizada ? "EM_OPERACAO" : "PARADA";
    const motivoParadaFinal = lojaDestinoNormalizada
      ? null
      : (observacao && observacao.trim()) || "Transferida para o galpão";

    await maquina.update(
      {
        lojaId: lojaDestinoNormalizada,
        statusOperacao: statusFinal,
        motivoParada: motivoParadaFinal,
      },
      { transaction },
    );

    const transferencia = await TransferenciaMaquina.create(
      {
        maquinaId: maquina.id,
        lojaOrigemId,
        lojaDestinoId: lojaDestinoNormalizada,
        dataTransferencia,
        usuarioId: req.usuario.id,
        observacao: observacao?.trim() || null,
      },
      { transaction },
    );

    await transaction.commit();

    const maquinaAtualizada = await Maquina.findByPk(maquina.id, {
      include: [
        { model: Loja, as: "loja", attributes: ["id", "nome", "cidade"] },
      ],
    });

    res.locals.entityId = maquina.id;
    res.json({ maquina: maquinaAtualizada, transferencia });
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao transferir máquina:", error);
    res.status(500).json({ error: "Erro ao transferir máquina" });
  }
};

// Histórico de transferências de uma máquina
export const listarTransferenciasMaquina = async (req, res) => {
  try {
    const { id } = req.params;

    const transferencias = await TransferenciaMaquina.findAll({
      where: { maquinaId: id },
      include: [
        { model: Loja, as: "lojaOrigem", attributes: ["id", "nome"] },
        { model: Loja, as: "lojaDestino", attributes: ["id", "nome"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
      order: [
        ["dataTransferencia", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    res.json(transferencias);
  } catch (error) {
    console.error("Erro ao listar transferências da máquina:", error);
    res.status(500).json({ error: "Erro ao listar transferências da máquina" });
  }
};
