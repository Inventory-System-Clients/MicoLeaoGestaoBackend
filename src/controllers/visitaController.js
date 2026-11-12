import { Op } from "sequelize";
import {
  Loja,
  Maquina,
  Movimentacao,
  MovimentacaoProduto,
  Produto,
  EstoqueLoja,
  UsuarioLoja,
} from "../models/index.js";
import { temAcao } from "../permissoes/acessos.js";
import { registrarMovimentacao } from "./movimentacaoController.js";

// Movimentação em passos (tela do Consultor de Vendas): escolhe a loja e a
// máquina, e faz a visita como um checklist — foto do relógio com IN/OUT,
// abastecimento, movimentação, limpeza do vidro, recolhimento de fichas,
// limpeza do piso e conferência final (portas, cadeados, chaves).
// Só nas lojas escolhidas no cadastro do usuário (ou todas, com lojas.todas).

const PASSOS_OBRIGATORIOS = ["limpezaVidro", "limpezaPiso", "portas", "cadeados", "chaves"];

// Fichas que ficaram na máquina sem recolher: soma das movimentações mais
// recentes marcadas como "não recolhidas", até a última que recolheu.
// Movimentação antiga (sem checklist, do roteiro) conta como recolhida.
const fichasPendentes = async (maquinaId) => {
  const recentes = await Movimentacao.findAll({
    where: { maquinaId },
    order: [["dataColeta", "DESC"]],
    attributes: ["fichas", "checklist"],
    limit: 60,
  });
  let total = 0;
  let movimentacoes = 0;
  for (const mov of recentes) {
    if (mov.checklist?.recolhimentoFichas !== false) break;
    total += Number(mov.fichas) || 0;
    movimentacoes += 1;
  }
  return { total, movimentacoes };
};
const inicioDeHojeEmBrasilia = () =>
  new Date(`${new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00.000-03:00`);

const lojasDoUsuario = async (usuario) => {
  if (temAcao(usuario, "lojas.todas")) return null; // null = todas
  const vinculos = await UsuarioLoja.findAll({ where: { usuarioId: usuario.id }, attributes: ["lojaId"] });
  return vinculos.map((v) => v.lojaId);
};

const podeNaLoja = async (usuario, lojaId) => {
  const permitidas = await lojasDoUsuario(usuario);
  return permitidas === null || permitidas.includes(lojaId);
};

const visitaController = {
  // Lojas do usuário com as máquinas e se já tiveram movimentação hoje
  async lojas(req, res) {
    try {
      const permitidas = await lojasDoUsuario(req.usuario);
      const where = { ativo: true };
      if (permitidas !== null) where.id = permitidas;
      const lojas = await Loja.findAll({
        where,
        attributes: ["id", "nome", "cidade"],
        include: [
          {
            model: Maquina,
            as: "maquinas",
            required: false,
            where: { ativo: true },
            attributes: ["id", "codigo", "nome", "tipo", "capacidadePadrao", "statusOperacao", "lojaId"],
          },
        ],
        order: [["nome", "ASC"]],
      });
      const maquinaIds = lojas.flatMap((loja) => loja.maquinas.map((m) => m.id));
      const feitasHoje = new Set(
        maquinaIds.length
          ? (
              await Movimentacao.findAll({
                where: { maquinaId: maquinaIds, dataColeta: { [Op.gte]: inicioDeHojeEmBrasilia() } },
                attributes: ["maquinaId"],
              })
            ).map((m) => m.maquinaId)
          : [],
      );
      res.json(
        lojas.map((loja) => ({
          ...loja.toJSON(),
          maquinas: loja.maquinas
            .map((m) => ({ ...m.toJSON(), feitaHoje: feitasHoje.has(m.id) }))
            .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), "pt-BR", { numeric: true })),
        })),
      );
    } catch (error) {
      console.error("Erro ao listar lojas da movimentação:", error);
      res.status(500).json({ error: "Erro ao carregar as lojas" });
    }
  },

  // Dados da máquina para a visita: última movimentação, produto da máquina
  // e o estoque da loja (de onde sai o abastecimento)
  async maquina(req, res) {
    try {
      const maquina = await Maquina.findByPk(req.params.id, {
        attributes: ["id", "codigo", "nome", "tipo", "capacidadePadrao", "lojaId"],
      });
      if (!maquina) return res.status(404).json({ error: "Máquina não encontrada" });
      if (!(await podeNaLoja(req.usuario, maquina.lojaId))) {
        return res.status(403).json({ error: "Você não tem acesso a essa loja." });
      }
      const [ultima, estoque, produtoDaMaquina] = await Promise.all([
        Movimentacao.findOne({
          where: { maquinaId: maquina.id },
          order: [["dataColeta", "DESC"]],
          attributes: ["id", "dataColeta", "contadorIn", "contadorOut", "totalPos", "fichas"],
          include: [{ model: MovimentacaoProduto, as: "detalhesProdutos", attributes: ["produtoId"] }],
        }),
        EstoqueLoja.findAll({
          where: { lojaId: maquina.lojaId, quantidade: { [Op.gt]: 0 } },
          attributes: ["produtoId", "quantidade"],
          include: [{ model: Produto, as: "produto", attributes: ["id", "nome", "codigo"] }],
        }),
        maquina.nome
          ? Produto.findOne({ where: { nome: { [Op.iLike]: maquina.nome.trim() } }, attributes: ["id"] })
          : null,
      ]);
      const produtoSugeridoId =
        produtoDaMaquina?.id || ultima?.detalhesProdutos?.[0]?.produtoId || null;
      const lista = estoque
        .filter((item) => item.produto)
        .map((item) => ({
          produtoId: item.produtoId,
          nome: item.produto.nome,
          codigo: item.produto.codigo,
          quantidade: Number(item.quantidade),
        }));
      // O produto cadastrado na máquina sempre aparece (já escolhido), mesmo
      // sem estoque na loja — aí mostra "0 na loja"
      if (produtoSugeridoId && !lista.some((item) => item.produtoId === produtoSugeridoId)) {
        const produto = await Produto.findByPk(produtoSugeridoId, { attributes: ["id", "nome", "codigo"] });
        if (produto) {
          lista.push({ produtoId: produto.id, nome: produto.nome, codigo: produto.codigo, quantidade: 0 });
        }
      }
      res.json({
        maquina,
        ultima,
        produtoSugeridoId,
        fichasPendentes: await fichasPendentes(maquina.id),
        estoque: lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      });
    } catch (error) {
      console.error("Erro ao carregar máquina da movimentação:", error);
      res.status(500).json({ error: "Erro ao carregar a máquina" });
    }
  },

  // Salva a visita: confere loja e checklist, e grava pela mesma regra da
  // movimentação de sempre (contadores, estoque da loja, faturamento)
  async registrar(req, res, next) {
    try {
      const maquina = await Maquina.findByPk(req.body.maquinaId, { attributes: ["id", "lojaId"] });
      if (!maquina) return res.status(404).json({ error: "Máquina não encontrada" });
      if (!(await podeNaLoja(req.usuario, maquina.lojaId))) {
        return res.status(403).json({ error: "Você não tem acesso a essa loja." });
      }
      if (!req.body.fotoRelogioUrl) {
        return res.status(400).json({ error: "Tire a foto do relógio antes de salvar." });
      }
      const checklist = req.body.checklist || {};
      const faltando = PASSOS_OBRIGATORIOS.filter((passo) => checklist[passo] !== true);
      if (faltando.length) {
        return res.status(400).json({ error: "Complete todos os passos do checklist antes de salvar.", faltando });
      }
      // Recolhimento de fichas é opcional: se recolheu, leva as do dia e as
      // que ficaram de movimentações anteriores sem recolher
      const recolheu = checklist.recolhimentoFichas === true;
      const pendentes = await fichasPendentes(maquina.id);
      const fichasDoDia = Math.max(0, Math.floor(Number(req.body.fichas) || 0));
      req.body.checklist = {
        ...Object.fromEntries(PASSOS_OBRIGATORIOS.map((passo) => [passo, true])),
        recolhimentoFichas: recolheu,
        fichasPendentesAntes: pendentes.total,
        fichasRecolhidas: recolheu ? pendentes.total + fichasDoDia : 0,
      };
      return registrarMovimentacao(req, res, next);
    } catch (error) {
      console.error("Erro ao registrar movimentação em passos:", error);
      res.status(500).json({ error: "Erro ao salvar a movimentação" });
    }
  },
};

export default visitaController;
