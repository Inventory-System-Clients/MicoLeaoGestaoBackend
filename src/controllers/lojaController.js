import { Loja, Maquina, UsuarioLoja } from "../models/index.js";

const NOMES_DEPOSITO_PRINCIPAL = ["deposito principal", "depósito principal"];
const ehDepositoPrincipal = (loja) =>
  NOMES_DEPOSITO_PRINCIPAL.includes(
    String(loja?.nome || "").trim().toLowerCase(),
  );

const VALOR_FICHA_PADRAO_DEFAULT = 2.5;

const normalizarValorFichaPadrao = (valor) => {
  if (valor === undefined || valor === null || valor === "") {
    return { informado: false, valor: undefined };
  }

  const valorNormalizado = Number(
    typeof valor === "string" ? valor.replace(",", ".") : valor,
  );

  if (!Number.isFinite(valorNormalizado) || valorNormalizado <= 0) {
    return { informado: true, invalido: true };
  }

  return {
    informado: true,
    valor: Number(valorNormalizado.toFixed(2)),
  };
};

// US04 - Listar todas as lojas
export const listarLojas = async (req, res) => {
  try {
    let lojas;

    // Admin, desenvolvedor e funcionário de estoque veem todas as lojas
    if (
      ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE"].includes(
        req.usuario.role,
      )
    ) {
      lojas = await Loja.findAll({
        include: [
          {
            model: Maquina,
            as: "maquinas",
            attributes: ["id", "codigo", "nome", "tipo", "ativo"],
          },
        ],
        order: [["nome", "ASC"]],
      });
    } else {
      // Funcionário vê apenas lojas permitidas
      const permissoes = await UsuarioLoja.findAll({
        where: { usuarioId: req.usuario.id },
        include: [
          {
            model: Loja,
            include: [
              {
                model: Maquina,
                as: "maquinas",
                attributes: ["id", "codigo", "nome", "tipo", "ativo"],
              },
            ],
          },
        ],
      });

      lojas = permissoes.map((p) => p.Loja);
    }

    res.json(lojas);
  } catch (error) {
    console.error("Erro ao listar lojas:", error);
    res.status(500).json({ error: "Erro ao listar lojas" });
  }
};

// US04 - Obter loja por ID
export const obterLoja = async (req, res) => {
  try {
    const loja = await Loja.findByPk(req.params.id, {
      include: [
        {
          model: Maquina,
          as: "maquinas",
        },
      ],
    });

    if (!loja) {
      return res.status(404).json({ error: "Loja não encontrada" });
    }

    res.json(loja);
  } catch (error) {
    console.error("Erro ao obter loja:", error);
    res.status(500).json({ error: "Erro ao obter loja" });
  }
};

// US04 - Criar loja
export const criarLoja = async (req, res) => {
  try {
    const {
      nome,
      endereco,
      cidade,
      estado,
      responsavel,
      telefone,
      statusOperacao,
      dataInicio,
      observacoes,
      dataVencimentoExtintor,
      dataFimContrato,
      diasAvisoContrato,
      valorFichaPadrao,
    } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "Nome da loja é obrigatório" });
    }

    const valorFichaNormalizado = normalizarValorFichaPadrao(valorFichaPadrao);
    if (valorFichaNormalizado.invalido) {
      return res.status(400).json({
        error: "valorFichaPadrao deve ser um número maior que zero",
      });
    }

    const loja = await Loja.create({
      nome,
      endereco,
      cidade,
      estado,
      responsavel,
      telefone,
      statusOperacao: statusOperacao || "ATIVA",
      dataInicio: dataInicio || null,
      observacoes: observacoes || null,
      dataVencimentoExtintor: dataVencimentoExtintor || null,
      dataFimContrato: dataFimContrato || null,
      diasAvisoContrato:
        diasAvisoContrato !== undefined && diasAvisoContrato !== null && diasAvisoContrato !== ""
          ? diasAvisoContrato
          : 60,
      valorFichaPadrao: valorFichaNormalizado.informado
        ? valorFichaNormalizado.valor
        : VALOR_FICHA_PADRAO_DEFAULT,
      ativo: statusOperacao ? statusOperacao !== "INATIVA" : true,
    });

    res.locals.entityId = loja.id;
    res.status(201).json(loja);
  } catch (error) {
    console.error("Erro ao criar loja:", error);
    res.status(500).json({ error: "Erro ao criar loja" });
  }
};

// US04 - Atualizar loja
export const atualizarLoja = async (req, res) => {
  try {
    const loja = await Loja.findByPk(req.params.id);

    if (!loja) {
      return res.status(404).json({ error: "Loja não encontrada" });
    }

    const {
      nome,
      endereco,
      cidade,
      estado,
      responsavel,
      telefone,
      statusOperacao,
      dataInicio,
      observacoes,
      dataVencimentoExtintor,
      dataFimContrato,
      diasAvisoContrato,
      contratoAvisoAdiadoDias,
      ativo,
      valorFichaPadrao,
    } = req.body;

    // Se a data de fim do contrato mudou (renovação), zera qualquer "adiar"
    // que tivesse sido configurado pro contrato anterior.
    const contratoMudou =
      dataFimContrato !== undefined &&
      String(dataFimContrato || "") !== String(loja.dataFimContrato || "");

    const valorFichaNormalizado = normalizarValorFichaPadrao(valorFichaPadrao);
    if (valorFichaNormalizado.invalido) {
      return res.status(400).json({
        error: "valorFichaPadrao deve ser um número maior que zero",
      });
    }

    if (ehDepositoPrincipal(loja)) {
      const tentandoRenomear = nome !== undefined && nome !== loja.nome;
      const ativoFinal =
        statusOperacao !== undefined
          ? statusOperacao !== "INATIVA"
          : ativo ?? loja.ativo;

      if (tentandoRenomear || !ativoFinal) {
        return res.status(400).json({
          error:
            "O Depósito Principal não pode ser renomeado nem desativado — é o estoque central do sistema.",
        });
      }
    }

    await loja.update({
      nome: nome ?? loja.nome,
      endereco: endereco ?? loja.endereco,
      cidade: cidade ?? loja.cidade,
      estado: estado ?? loja.estado,
      responsavel: responsavel ?? loja.responsavel,
      telefone: telefone ?? loja.telefone,
      statusOperacao: statusOperacao ?? loja.statusOperacao,
      dataInicio: dataInicio ?? loja.dataInicio,
      observacoes: observacoes ?? loja.observacoes,
      dataVencimentoExtintor:
        dataVencimentoExtintor ?? loja.dataVencimentoExtintor,
      dataFimContrato: dataFimContrato ?? loja.dataFimContrato,
      diasAvisoContrato: diasAvisoContrato ?? loja.diasAvisoContrato,
      contratoAvisoAdiadoDias: contratoMudou
        ? null
        : (contratoAvisoAdiadoDias ?? loja.contratoAvisoAdiadoDias),
      valorFichaPadrao: valorFichaNormalizado.informado
        ? valorFichaNormalizado.valor
        : loja.valorFichaPadrao,
      ativo:
        statusOperacao !== undefined
          ? statusOperacao !== "INATIVA"
          : ativo ?? loja.ativo,
    });

    res.json(loja);
  } catch (error) {
    console.error("Erro ao atualizar loja:", error);
    res.status(500).json({ error: "Erro ao atualizar loja" });
  }
};

// US04 - Deletar loja
export const deletarLoja = async (req, res) => {
  try {
    const loja = await Loja.findByPk(req.params.id);

    if (!loja) {
      return res.status(404).json({ error: "Loja não encontrada" });
    }

    if (ehDepositoPrincipal(loja)) {
      return res.status(400).json({
        error:
          "O Depósito Principal não pode ser excluído nem desativado — é o estoque central do sistema.",
      });
    }

    // Verificar se já está inativa (segunda tentativa = hard delete)
    if (!loja.ativo) {
      // Hard delete - deletar permanentemente
      await Maquina.destroy({ where: { lojaId: loja.id } });
      await loja.destroy();
      return res.json({ message: "Loja deletada permanentemente" });
    }

    // Primeira tentativa: Soft delete (marcar como inativo)
    await loja.update({ ativo: false });
    res.json({ message: "Loja desativada com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar loja:", error);
    res.status(500).json({ error: "Erro ao deletar loja" });
  }
};
