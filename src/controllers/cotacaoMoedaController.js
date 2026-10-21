import { CotacaoMoeda, Usuario } from "../models/index.js";
import {
  buscarHistoricoCotacao,
  cotacaoNaData,
} from "../services/cotacaoService.js";

const MOEDAS_CONFIGURAVEIS = ["USD"];

// Cotação atual + histórico de trocas (mais recente primeiro).
export const listarCotacoes = async (req, res) => {
  try {
    const moeda = req.query.moeda || "USD";
    const [historico, linhas] = await Promise.all([
      buscarHistoricoCotacao(moeda),
      CotacaoMoeda.findAll({
        where: { moeda },
        order: [["vigenteDesde", "DESC"]],
        include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome"] }],
      }),
    ]);

    res.json({ moeda, cotacaoAtual: cotacaoNaData(historico), historico: linhas });
  } catch (error) {
    console.error("Erro ao listar cotações:", error);
    res.status(500).json({ error: "Erro ao listar cotações" });
  }
};

// Nova cotação vale a partir de agora; as anteriores nunca são alteradas.
export const registrarCotacao = async (req, res) => {
  try {
    const moeda = req.body.moeda || "USD";
    if (!MOEDAS_CONFIGURAVEIS.includes(moeda)) {
      return res.status(400).json({ error: "Moeda inválida" });
    }

    const valorEmReal = Number(String(req.body.valorEmReal ?? "").replace(",", "."));
    if (!Number.isFinite(valorEmReal) || valorEmReal <= 0) {
      return res.status(400).json({ error: "Informe uma cotação maior que zero" });
    }

    const atual = cotacaoNaData(await buscarHistoricoCotacao(moeda));
    if (Number(atual.toFixed(4)) === Number(valorEmReal.toFixed(4))) {
      return res.status(400).json({ error: "Essa já é a cotação atual" });
    }

    const cotacao = await CotacaoMoeda.create({
      moeda,
      valorEmReal: Number(valorEmReal.toFixed(4)),
      vigenteDesde: new Date(),
      usuarioId: req.usuario?.id || null,
    });

    res.locals.entityId = cotacao.id;
    res.status(201).json(cotacao);
  } catch (error) {
    console.error("Erro ao registrar cotação:", error);
    res.status(500).json({ error: "Erro ao registrar cotação" });
  }
};
