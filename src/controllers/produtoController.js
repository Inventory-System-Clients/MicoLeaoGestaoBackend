import { Op } from "sequelize";
import { CategoriaProduto, Produto, ProdutoCustoHistorico, Usuario } from "../models/index.js";
import { sequelize } from "../database/connection.js";
import { gerarSkuProduto } from "../utils/skuProduto.js";
import { registrarTrocaCustoProduto } from "../services/custoProdutoService.js";
import {
  buscarNomeRepetido,
  chaveNome,
  mensagemNomeRepetido,
} from "../utils/nomeCadastro.js";

const normalizarCusto = (valor) => {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return NaN;
  return Number(numero.toFixed(2));
};

// US06 - Listar produtos
export const listarProdutos = async (req, res) => {
  try {
    const { categoria, incluirInativos } = req.query;
    const where = {};

    if (categoria) {
      where.categoria = categoria;
    }

    // Por padrão, só mostra produtos ativos
    // Para ver inativos, passar ?incluirInativos=true
    if (incluirInativos !== "true") {
      where.ativo = true;
    }

    const produtos = await Produto.findAll({
      where,
      order: [["nome", "ASC"]],
    });

    res.json(produtos);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ error: "Erro ao listar produtos" });
  }
};

// US06 - Obter produto por ID
export const obterProduto = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    const historicoCustos = await ProdutoCustoHistorico.findAll({
      where: { produtoId: produto.id },
      order: [["vigenteDesde", "DESC"]],
      include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome"] }],
    });

    res.json({ ...produto.toJSON(), historicoCustos });
  } catch (error) {
    console.error("Erro ao obter produto:", error);
    res.status(500).json({ error: "Erro ao obter produto" });
  }
};

// US06 - Criar produto
export const criarProduto = async (req, res) => {
  try {
    // O SKU (`codigo`) não é mais digitado: o sistema gera (utils/skuProduto.js)
    const {
      nome,
      descricao,
      categoria,
      tamanho,
      emoji,
      preco,
      custoUnitario,
      estoqueAtual,
      estoqueMinimo,
      imagemUrl,
      ativo,
    } = req.body;

    const custoNormalizado = normalizarCusto(custoUnitario);
    if (Number.isNaN(custoNormalizado)) {
      return res.status(400).json({ error: "Custo unitário inválido" });
    }

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ error: "Nome do produto é obrigatório" });
    }

    const nomeRepetido = await buscarNomeRepetido(Produto, nome);
    if (nomeRepetido) {
      return res
        .status(400)
        .json({ error: mensagemNomeRepetido("um produto", nomeRepetido) });
    }

    const produto = await sequelize.transaction(async (transaction) =>
      Produto.create(
        {
          codigo: await gerarSkuProduto(transaction),
          nome,
          descricao,
          categoria,
          tamanho,
          emoji,
          preco,
          custoUnitario: custoNormalizado ?? undefined,
          estoqueAtual,
          estoqueMinimo,
          imagemUrl,
          ativo,
        },
        { transaction },
      ),
    );

    await registrarTrocaCustoProduto({
      produtoId: produto.id,
      custoAnterior: 0,
      custoNovo: custoNormalizado,
      usuarioId: req.usuario?.id,
    });

    res.locals.entityId = produto.id;
    res.status(201).json(produto);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
};

// US06 - Atualizar produto
export const atualizarProduto = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // SKU (`codigo`) é do sistema: não muda na edição
    const {
      nome,
      descricao,
      categoria,
      tamanho,
      emoji,
      preco,
      custoUnitario,
      estoqueAtual,
      estoqueMinimo,
      imagemUrl,
      ativo,
    } = req.body;

    const custoNormalizado = normalizarCusto(custoUnitario);
    if (Number.isNaN(custoNormalizado)) {
      return res.status(400).json({ error: "Custo unitário inválido" });
    }


    if (nome !== undefined && nome !== null) {
      if (!String(nome).trim()) {
        return res.status(400).json({ error: "Nome do produto é obrigatório" });
      }
      // Só checa se o nome mudou de fato: duplicados antigos continuam editáveis
      if (chaveNome(nome) !== chaveNome(produto.nome)) {
        const nomeRepetido = await buscarNomeRepetido(Produto, nome, {
          ignorarId: produto.id,
        });
        if (nomeRepetido) {
          return res
            .status(400)
            .json({ error: mensagemNomeRepetido("um produto", nomeRepetido) });
        }
      }
    }

    const custoAnterior = produto.custoUnitario;

    await produto.update({
      nome: nome ?? produto.nome,
      descricao: descricao ?? produto.descricao,
      categoria: categoria ?? produto.categoria,
      tamanho: tamanho ?? produto.tamanho,
      emoji: emoji ?? produto.emoji,
      preco: preco ?? produto.preco,
      custoUnitario: custoNormalizado ?? produto.custoUnitario,
      estoqueAtual: estoqueAtual ?? produto.estoqueAtual,
      estoqueMinimo: estoqueMinimo ?? produto.estoqueMinimo,
      imagemUrl: imagemUrl ?? produto.imagemUrl,
      ativo: ativo ?? produto.ativo,
    });

    await registrarTrocaCustoProduto({
      produtoId: produto.id,
      custoAnterior,
      custoNovo: custoNormalizado,
      usuarioId: req.usuario?.id,
    });

    res.json(produto);
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro ao atualizar produto" });
  }
};

// US06 - Deletar produto (soft delete na 1ª vez, hard delete na 2ª)
export const deletarProduto = async (req, res) => {
  try {
    const produto = await Produto.findByPk(req.params.id);

    if (!produto) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    // Se já está inativo, deletar permanentemente
    if (!produto.ativo) {
      await produto.destroy();
      res.locals.entityId = req.params.id;
      return res.json({
        message: "Produto excluído permanentemente com sucesso",
        permanentDelete: true,
      });
    }

    // Se está ativo, apenas desativar (soft delete)
    await produto.update({ ativo: false });
    res.locals.entityId = produto.id;
    res.json({
      message:
        "Produto desativado com sucesso. Clique novamente para excluir permanentemente.",
      permanentDelete: false,
    });
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    res.status(500).json({ error: "Erro ao deletar produto" });
  }
};

// Categorias usadas nos produtos que ainda não estão cadastradas entram no
// cadastro (assim o cadastro sempre tem todas)
const sincronizarCategorias = async () => {
  const usadas = await Produto.findAll({
    attributes: [[sequelize.fn("DISTINCT", sequelize.col("categoria")), "categoria"]],
    where: { categoria: { [Op.ne]: null } },
    raw: true,
  });
  const cadastradas = await CategoriaProduto.findAll({ attributes: ["nome"], raw: true });
  const nomes = new Set(cadastradas.map((c) => c.nome.trim().toLowerCase()));
  for (const { categoria } of usadas) {
    const nome = String(categoria || "").trim();
    if (nome && !nomes.has(nome.toLowerCase())) {
      await CategoriaProduto.create({ nome: nome.slice(0, 50) }).catch(() => {});
      nomes.add(nome.toLowerCase());
    }
  }
};

// Nomes das categorias (cadastradas + usadas), em ordem
export const listarCategorias = async (req, res) => {
  try {
    await sincronizarCategorias();
    const categorias = await CategoriaProduto.findAll({ attributes: ["nome"], order: [["nome", "ASC"]], raw: true });
    res.json(categorias.map((c) => c.nome));
  } catch (error) {
    console.error("Erro ao listar categorias:", error);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
};

// ---------- Cadastro de categorias ----------
const nomeDaCategoria = (valor) => String(valor || "").trim().replace(/\s+/g, " ").slice(0, 50);

export const listarCadastroCategorias = async (req, res) => {
  try {
    await sincronizarCategorias();
    const [categorias, contagem] = await Promise.all([
      CategoriaProduto.findAll({ order: [["nome", "ASC"]] }),
      Produto.findAll({
        attributes: ["categoria", [sequelize.fn("COUNT", sequelize.col("id")), "total"]],
        where: { categoria: { [Op.ne]: null } },
        group: ["categoria"],
        raw: true,
      }),
    ]);
    const porNome = new Map(contagem.map((c) => [String(c.categoria).trim().toLowerCase(), Number(c.total)]));
    res.json(categorias.map((c) => ({ id: c.id, nome: c.nome, produtos: porNome.get(c.nome.trim().toLowerCase()) || 0 })));
  } catch (error) {
    console.error("Erro ao listar categorias:", error);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
};

export const criarCategoria = async (req, res) => {
  try {
    const nome = nomeDaCategoria(req.body.nome);
    if (nome.length < 2) return res.status(400).json({ error: "Escreva o nome da categoria." });
    const existe = await CategoriaProduto.findOne({ where: sequelize.where(sequelize.fn("lower", sequelize.col("nome")), nome.toLowerCase()) });
    if (existe) return res.status(400).json({ error: "Já existe uma categoria com esse nome." });
    const categoria = await CategoriaProduto.create({ nome });
    res.status(201).json(categoria);
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    res.status(500).json({ error: "Erro ao criar categoria" });
  }
};

// Renomear: os produtos dessa categoria passam para o nome novo
export const renomearCategoria = async (req, res) => {
  try {
    const categoria = await CategoriaProduto.findByPk(req.params.id);
    if (!categoria) return res.status(404).json({ error: "Categoria não encontrada" });
    const nome = nomeDaCategoria(req.body.nome);
    if (nome.length < 2) return res.status(400).json({ error: "Escreva o nome da categoria." });
    const outra = await CategoriaProduto.findOne({
      where: { [Op.and]: [sequelize.where(sequelize.fn("lower", sequelize.col("nome")), nome.toLowerCase()), { id: { [Op.ne]: categoria.id } }] },
    });
    if (outra) return res.status(400).json({ error: "Já existe uma categoria com esse nome." });
    const antigo = categoria.nome;
    await sequelize.transaction(async (transaction) => {
      await categoria.update({ nome }, { transaction });
      await Produto.update(
        { categoria: nome },
        { where: sequelize.where(sequelize.fn("lower", sequelize.fn("trim", sequelize.col("categoria"))), antigo.trim().toLowerCase()), transaction },
      );
    });
    res.json(categoria);
  } catch (error) {
    console.error("Erro ao renomear categoria:", error);
    res.status(500).json({ error: "Erro ao renomear categoria" });
  }
};

// Excluir: só se nenhum produto usa
export const excluirCategoria = async (req, res) => {
  try {
    const categoria = await CategoriaProduto.findByPk(req.params.id);
    if (!categoria) return res.status(404).json({ error: "Categoria não encontrada" });
    const usando = await Produto.count({
      where: sequelize.where(sequelize.fn("lower", sequelize.fn("trim", sequelize.col("categoria"))), categoria.nome.trim().toLowerCase()),
    });
    if (usando) {
      return res.status(400).json({ error: `${usando} produto(s) usam essa categoria. Troque a categoria deles antes de excluir.` });
    }
    await categoria.destroy();
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir categoria:", error);
    res.status(500).json({ error: "Erro ao excluir categoria" });
  }
};
