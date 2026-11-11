import { Produto, ProdutoCustoHistorico, Usuario } from "../models/index.js";
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
    const {
      codigo,
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

    // Verificar se código já existe (se fornecido)
    if (codigo) {
      const produtoExistente = await Produto.findOne({ where: { codigo } });
      if (produtoExistente) {
        return res.status(400).json({ error: "Código de produto já existe" });
      }
    }

    const produto = await Produto.create({
      codigo,
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
    });

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

    const {
      codigo,
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

    // Verificar código duplicado se estiver mudando
    if (codigo && codigo !== produto.codigo) {
      const produtoExistente = await Produto.findOne({ where: { codigo } });
      if (produtoExistente) {
        return res.status(400).json({ error: "Código de produto já existe" });
      }
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
      codigo: codigo ?? produto.codigo,
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

// Listar categorias únicas
export const listarCategorias = async (req, res) => {
  try {
    const categorias = await Produto.findAll({
      attributes: [
        [sequelize.fn("DISTINCT", sequelize.col("categoria")), "categoria"],
      ],
      where: {
        categoria: { [sequelize.Op.ne]: null },
      },
      raw: true,
    });

    res.json(categorias.map((c) => c.categoria));
  } catch (error) {
    console.error("Erro ao listar categorias:", error);
    res.status(500).json({ error: "Erro ao listar categorias" });
  }
};
