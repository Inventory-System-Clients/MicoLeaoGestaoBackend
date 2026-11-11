import { Op } from "sequelize";
import { sequelize } from "../database/connection.js";
import {
  ProjetoLoja,
  ProjetoLojaMaquina,
  ProjetoLojaMaquinaHistorico,
  Loja,
  Maquina,
  TransferenciaMaquina,
} from "../models/index.js";
import { ehLojaDeProjetoEmImplantacao } from "../utils/lojaProjeto.js";

// Máquinas do projeto de loja ficam GRAVADAS no projeto:
//   origem LOJA    -> máquina que está na loja do projeto (atualizada aqui)
//   origem RESERVA -> adicionada à mão (do depósito ou "a comprar")
// Enquanto o projeto está aberto, toda entrada/saída de máquina da loja é
// gravada em projeto_loja_maquina_historico. Concluído ou cancelado, o
// projeto congela: nada aqui mexe mais nele.

export const STATUS_PROJETO_FECHADO = ["CONCLUIDO", "CANCELADO"];

const dataHojeLocal = () => {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
};

const nomeDaMaquina = (maquina) =>
  maquina?.codigo ? `${maquina.codigo} — ${maquina.nome || ""}`.trim() : maquina?.nome || "Máquina";

const nomeDaLoja = async (lojaId, transaction) => {
  if (!lojaId) return "Depósito";
  const loja = await Loja.findByPk(lojaId, { attributes: ["nome"], transaction });
  return loja?.nome || "outra loja";
};

// Última transferência da máquina que bate com a movimentação (entrando ou
// saindo da loja), feita depois que o projeto começou.
const buscarTransferencia = (maquinaId, filtroLoja, desde, transaction) =>
  TransferenciaMaquina.findOne({
    where: { maquinaId, ...filtroLoja, createdAt: { [Op.gte]: desde } },
    order: [["createdAt", "DESC"]],
    transaction,
  });

// aoVincularLoja: a loja acabou de ser ligada ao projeto (criação ou troca de
// loja), então quem já está nela "já estava lá", não "entrou agora".
export const sincronizarMaquinasDoProjeto = async (
  projetoId,
  { transaction, aoVincularLoja = false },
) => {
  const projeto = await ProjetoLoja.findByPk(projetoId, {
    include: [{ model: Loja, as: "loja", attributes: ["id", "nome", "statusOperacao", "ativo"] }],
    transaction,
    lock: { level: transaction.LOCK.UPDATE, of: ProjetoLoja },
  });

  if (!projeto || STATUS_PROJETO_FECHADO.includes(projeto.status)) return;

  const lojaReal =
    projeto.lojaId && projeto.loja && !ehLojaDeProjetoEmImplantacao(projeto.loja);

  const linhas = await ProjetoLojaMaquina.findAll({
    where: { projetoLojaId: projeto.id },
    include: [{ model: Maquina, as: "maquina", attributes: ["id", "codigo", "nome", "lojaId"] }],
    transaction,
  });

  const naLojaAgora = lojaReal
    ? await Maquina.findAll({
        where: { lojaId: projeto.lojaId },
        attributes: ["id", "codigo", "nome", "custoAquisicao"],
        transaction,
      })
    : [];
  const idsNaLojaAgora = new Set(naLojaAgora.map((m) => m.id));

  // Primeira sincronização do projeto também conta como vínculo da loja
  const primeiraVez =
    aoVincularLoja ||
    (await ProjetoLojaMaquinaHistorico.count({
      where: { projetoLojaId: projeto.id, tipo: { [Op.in]: ["ENTRADA", "SAIDA"] } },
      transaction,
    })) === 0;

  const registrar = (dados) =>
    ProjetoLojaMaquinaHistorico.create(
      { projetoLojaId: projeto.id, data: dataHojeLocal(), ...dados },
      { transaction },
    );

  // 1) Máquinas que entraram na loja
  for (const maquina of naLojaAgora) {
    const linhaLoja = linhas.find((l) => l.origem === "LOJA" && l.maquinaId === maquina.id);
    if (linhaLoja) continue;

    const reserva = linhas.find((l) => l.origem === "RESERVA" && l.maquinaId === maquina.id);
    const transferencia = await buscarTransferencia(
      maquina.id,
      { lojaDestinoId: projeto.lojaId },
      projeto.createdAt,
      transaction,
    );

    let detalhe;
    if (reserva) {
      detalhe = "Chegou do depósito (estava reservada no projeto)";
      await reserva.update({ origem: "LOJA" }, { transaction });
    } else {
      detalhe = transferencia
        ? `Veio de ${await nomeDaLoja(transferencia.lojaOrigemId, transaction)}`
        : primeiraVez
          ? "Já estava na loja quando entrou no projeto"
          : "Entrou na loja (alteração no cadastro da máquina)";
      await ProjetoLojaMaquina.create(
        {
          projetoLojaId: projeto.id,
          maquinaId: maquina.id,
          nome: maquina.nome || maquina.codigo || "Máquina",
          quantidade: 1,
          custoUnitario: Number(maquina.custoAquisicao || 0),
          custoTotal: Number(maquina.custoAquisicao || 0),
          origem: "LOJA",
        },
        { transaction },
      );
    }

    await registrar({
      maquinaId: maquina.id,
      maquinaNome: nomeDaMaquina(maquina),
      tipo: "ENTRADA",
      detalhe,
      data: transferencia?.dataTransferencia || dataHojeLocal(),
      usuarioId: transferencia?.usuarioId || null,
    });
  }

  // 2) Máquinas que saíram da loja
  for (const linha of linhas.filter((l) => l.origem === "LOJA")) {
    if (idsNaLojaAgora.has(linha.maquinaId)) continue;

    const transferencia = await buscarTransferencia(
      linha.maquinaId,
      { lojaOrigemId: projeto.lojaId },
      projeto.createdAt,
      transaction,
    );
    const destino = await nomeDaLoja(
      transferencia ? transferencia.lojaDestinoId : linha.maquina?.lojaId,
      transaction,
    );

    await linha.destroy({ transaction });
    await registrar({
      maquinaId: linha.maquinaId,
      maquinaNome: nomeDaMaquina(linha.maquina) || linha.nome,
      tipo: "SAIDA",
      detalhe: transferencia
        ? `Foi para ${destino}`
        : `Foi para ${destino} (alteração no cadastro da máquina)`,
      data: transferencia?.dataTransferencia || dataHojeLocal(),
      usuarioId: transferencia?.usuarioId || null,
    });
  }

  // 3) Reservas do depósito que foram parar em outra loja
  for (const linha of linhas.filter((l) => l.origem === "RESERVA" && l.maquinaId)) {
    const lojaAtual = linha.maquina?.lojaId;
    if (!lojaAtual || lojaAtual === projeto.lojaId) continue;

    await linha.destroy({ transaction });
    await registrar({
      maquinaId: linha.maquinaId,
      maquinaNome: nomeDaMaquina(linha.maquina) || linha.nome,
      tipo: "SAIDA",
      detalhe: `Reserva cancelada: saiu do depósito para ${await nomeDaLoja(lojaAtual, transaction)}`,
    });
  }
};

// Chamado depois de uma máquina mudar de loja (transferência, edição ou
// cadastro): sincroniza os projetos abertos da loja de origem, da de destino e
// os que tinham a máquina reservada. Falha aqui não desfaz a transferência.
export const sincronizarProjetosDaMaquina = async (maquinaId, lojaIds = []) => {
  try {
    const lojas = lojaIds.filter(Boolean);
    const projetos = await ProjetoLoja.findAll({
      where: {
        status: { [Op.notIn]: STATUS_PROJETO_FECHADO },
        [Op.or]: [
          ...(lojas.length ? [{ lojaId: { [Op.in]: lojas } }] : []),
          { "$maquinas.maquinaId$": maquinaId },
        ],
      },
      include: [{ model: ProjetoLojaMaquina, as: "maquinas", attributes: [], required: false }],
      attributes: ["id"],
    });

    for (const { id } of projetos) {
      await sequelize.transaction((transaction) =>
        sincronizarMaquinasDoProjeto(id, { transaction }),
      );
    }
  } catch (error) {
    console.error("Erro ao sincronizar projetos de loja da máquina:", error);
  }
};
