import { sequelize } from "../database/connection.js";
import {
  EstoqueLoja,
  Envio,
  ItemLacre,
  Lacre,
  Loja,
  Produto,
  Usuario,
  UsuarioLoja,
} from "../models/index.js";

const usuarioPodeConferirLoja = async (usuario, lojaId) => {
  if (
    ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE"].includes(usuario.role)
  ) {
    return true;
  }

  const permissao = await UsuarioLoja.findOne({
    where: { usuarioId: usuario.id, lojaId },
  });

  return Boolean(permissao);
};

export const listarLacresPendentes = async (req, res) => {
  try {
    const { lojaId } = req.query;

    if (!lojaId) {
      return res.status(400).json({ error: "lojaId é obrigatório" });
    }

    const podeConferir = await usuarioPodeConferirLoja(req.usuario, lojaId);
    if (!podeConferir) {
      return res
        .status(403)
        .json({ error: "Você não tem permissão para conferir esta loja" });
    }

    const lacres = await Lacre.findAll({
      where: { status: "EM_TRANSITO" },
      attributes: { exclude: ["numero", "numeroDigitado"] },
      include: [
        {
          model: Envio,
          as: "envio",
          where: { lojaDestinoId: lojaId },
          attributes: ["id", "despachadoEm", "observacao"],
          include: [
            { model: Usuario, as: "transportador", attributes: ["id", "nome"] },
          ],
        },
        {
          model: ItemLacre,
          as: "itens",
          include: [
            {
              model: Produto,
              as: "produto",
              attributes: ["id", "nome", "codigo"],
            },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    res.json(lacres);
  } catch (error) {
    console.error("Erro ao listar lacres pendentes:", error);
    res.status(500).json({ error: "Erro ao listar lacres pendentes" });
  }
};

// --- ALERTA: CARRINHO/LACRE ENVIADO E NÃO CONFERIDO ---
export const alertasLacresEmTransito = async (req, res) => {
  try {
    const lacres = await Lacre.findAll({
      where: { status: "EM_TRANSITO" },
      include: [
        {
          model: Envio,
          as: "envio",
          include: [
            { model: Loja, as: "lojaDestino", attributes: ["id", "nome"] },
            { model: Usuario, as: "transportador", attributes: ["id", "nome"] },
          ],
        },
        {
          model: ItemLacre,
          as: "itens",
          include: [
            { model: Produto, as: "produto", attributes: ["id", "nome"] },
          ],
        },
      ],
    });

    const agora = new Date();

    const alertas = lacres
      .map((lacre) => {
        const despachadoEm = lacre.envio?.despachadoEm
          ? new Date(lacre.envio.despachadoEm)
          : null;
        const diasEmTransito = despachadoEm
          ? Math.floor((agora - despachadoEm) / (1000 * 60 * 60 * 24))
          : null;

        return {
          titulo: `Lacre ${lacre.numero}`,
          numero: lacre.numero,
          loja: lacre.envio?.lojaDestino
            ? {
                id: lacre.envio.lojaDestino.id,
                nome: lacre.envio.lojaDestino.nome,
              }
            : null,
          transportador: lacre.envio?.transportador?.nome,
          despachadoEm: lacre.envio?.despachadoEm,
          diasEmTransito,
          mensagem:
            diasEmTransito !== null
              ? `Em trânsito há ${diasEmTransito} dia(s), aguardando conferência`
              : "Aguardando conferência",
          createdAt: lacre.envio?.despachadoEm,
        };
      })
      .sort((a, b) => (b.diasEmTransito ?? 0) - (a.diasEmTransito ?? 0));

    res.json({ totalAlertas: alertas.length, alertas });
  } catch (error) {
    console.error("Erro ao buscar alertas de lacres em trânsito:", error);
    res
      .status(500)
      .json({ error: "Erro ao buscar alertas de lacres em trânsito" });
  }
};

export const listarLacresDivergentes = async (req, res) => {
  try {
    const lacres = await Lacre.findAll({
      where: { status: "DIVERGENTE" },
      include: [
        {
          model: Envio,
          as: "envio",
          include: [
            { model: Loja, as: "lojaDestino", attributes: ["id", "nome"] },
          ],
        },
        { model: Usuario, as: "conferidoPor", attributes: ["id", "nome"] },
      ],
      order: [["conferidoEm", "DESC"]],
    });

    res.json(lacres);
  } catch (error) {
    console.error("Erro ao listar lacres divergentes:", error);
    res.status(500).json({ error: "Erro ao listar lacres divergentes" });
  }
};

export const conferirLacre = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { numeroDigitado } = req.body;

    if (!numeroDigitado || !String(numeroDigitado).trim()) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Informe o número do lacre para conferir" });
    }

    const lacre = await Lacre.findByPk(req.params.id, {
      include: [
        { model: Envio, as: "envio" },
        { model: ItemLacre, as: "itens" },
      ],
      transaction,
    });

    if (!lacre) {
      await transaction.rollback();
      return res.status(404).json({ error: "Lacre não encontrado" });
    }

    const podeConferir = await usuarioPodeConferirLoja(
      req.usuario,
      lacre.envio.lojaDestinoId,
    );
    if (!podeConferir) {
      await transaction.rollback();
      return res
        .status(403)
        .json({ error: "Você não tem permissão para conferir esta loja" });
    }

    if (lacre.status !== "EM_TRANSITO") {
      await transaction.rollback();
      return res.status(400).json({
        error: "Este lacre não está aguardando conferência",
      });
    }

    const numeroDigitadoNormalizado = String(numeroDigitado).trim();

    if (numeroDigitadoNormalizado !== lacre.numero) {
      await lacre.update(
        {
          status: "DIVERGENTE",
          numeroDigitado: numeroDigitadoNormalizado,
          conferidoPorId: req.usuario.id,
          conferidoEm: new Date(),
        },
        { transaction },
      );

      await transaction.commit();

      const lacreDivergente = await Lacre.findByPk(lacre.id, {
        include: [
          { model: Envio, as: "envio" },
          { model: ItemLacre, as: "itens" },
        ],
      });

      return res.json(lacreDivergente);
    }

    for (const item of lacre.itens) {
      const [estoque] = await EstoqueLoja.findOrCreate({
        where: {
          lojaId: lacre.envio.lojaDestinoId,
          produtoId: item.produtoId,
        },
        defaults: { quantidade: 0 },
        transaction,
      });

      await estoque.update(
        { quantidade: Number(estoque.quantidade || 0) + item.quantidade },
        { transaction },
      );
    }

    await lacre.update(
      {
        status: "CONFERIDO",
        numeroDigitado: numeroDigitadoNormalizado,
        conferidoPorId: req.usuario.id,
        conferidoEm: new Date(),
      },
      { transaction },
    );

    await transaction.commit();

    const lacreConferido = await Lacre.findByPk(lacre.id, {
      include: [
        { model: Envio, as: "envio" },
        { model: ItemLacre, as: "itens" },
      ],
    });

    res.json(lacreConferido);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao conferir lacre:", error);
    res.status(500).json({ error: "Erro ao conferir lacre" });
  }
};

export const resolverLacreDivergente = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const lacre = await Lacre.findByPk(req.params.id, {
      include: [
        { model: Envio, as: "envio" },
        { model: ItemLacre, as: "itens" },
      ],
      transaction,
    });

    if (!lacre) {
      await transaction.rollback();
      return res.status(404).json({ error: "Lacre não encontrado" });
    }

    if (lacre.status !== "DIVERGENTE") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: "Só é possível resolver um lacre divergente" });
    }

    for (const item of lacre.itens) {
      const [estoque] = await EstoqueLoja.findOrCreate({
        where: {
          lojaId: lacre.envio.lojaDestinoId,
          produtoId: item.produtoId,
        },
        defaults: { quantidade: 0 },
        transaction,
      });

      await estoque.update(
        { quantidade: Number(estoque.quantidade || 0) + item.quantidade },
        { transaction },
      );
    }

    await lacre.update(
      {
        status: "CONFERIDO",
      },
      { transaction },
    );

    await transaction.commit();

    const lacreResolvido = await Lacre.findByPk(lacre.id, {
      include: [
        { model: Envio, as: "envio" },
        { model: ItemLacre, as: "itens" },
      ],
    });

    res.json(lacreResolvido);
  } catch (error) {
    await transaction.rollback();
    console.error("Erro ao resolver lacre divergente:", error);
    res.status(500).json({ error: "Erro ao resolver lacre divergente" });
  }
};

export const reabrirLacre = async (req, res) => {
  try {
    const lacre = await Lacre.findByPk(req.params.id);

    if (!lacre) {
      return res.status(404).json({ error: "Lacre não encontrado" });
    }

    if (lacre.status !== "DIVERGENTE") {
      return res
        .status(400)
        .json({ error: "Só é possível reabrir um lacre divergente" });
    }

    await lacre.update({
      status: "EM_TRANSITO",
      numeroDigitado: null,
      conferidoPorId: null,
      conferidoEm: null,
    });

    res.json(lacre);
  } catch (error) {
    console.error("Erro ao reabrir lacre:", error);
    res.status(500).json({ error: "Erro ao reabrir lacre" });
  }
};
