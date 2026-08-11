import { Fornecedor, FornecedorAnexo, FornecedorProduto } from "../models/index.js";

const includeFornecedor = [
  {
    model: FornecedorProduto,
    as: "produtos",
    separate: true,
    order: [["produtoNome", "ASC"]],
  },
  {
    model: FornecedorAnexo,
    as: "anexos",
    separate: true,
    order: [["createdAt", "DESC"]],
  },
];

const normalizarTexto = (valor) => String(valor || "").trim();

const normalizarProduto = (produto) => {
  const produtoNome = normalizarTexto(produto.produtoNome || produto.nome);
  const quantidade = Number(produto.quantidade);
  const preco = Number(produto.preco);
  const unidade = normalizarTexto(produto.unidade) || "un";
  const observacoes = normalizarTexto(produto.observacoes) || null;

  if (!produtoNome) throw new Error("Produto e obrigatorio");
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error("Quantidade do produto deve ser maior que zero");
  }
  if (!Number.isFinite(preco) || preco < 0) {
    throw new Error("Preco do produto e obrigatorio");
  }

  return { produtoNome, quantidade, preco, unidade, observacoes };
};

const normalizarAnexo = (anexo) => {
  const url = normalizarTexto(anexo.url);
  if (!url) return null;
  return {
    titulo: normalizarTexto(anexo.titulo) || null,
    url,
    tipo: normalizarTexto(anexo.tipo).toUpperCase() || "ORCAMENTO",
  };
};

const normalizarFornecedor = (body) => {
  const nome = normalizarTexto(body.nome);
  const produtos = Array.isArray(body.produtos) ? body.produtos.map(normalizarProduto) : [];
  const anexos = Array.isArray(body.anexos)
    ? body.anexos.map(normalizarAnexo).filter(Boolean)
    : [];

  if (!nome) throw new Error("Nome do fornecedor e obrigatorio");

  return {
    fornecedor: {
      nome,
      contato: normalizarTexto(body.contato) || null,
      telefoneWhatsapp: normalizarTexto(body.telefoneWhatsapp) || null,
      cidade: normalizarTexto(body.cidade) || null,
      observacoes: normalizarTexto(body.observacoes) || null,
      ativo: body.ativo !== undefined ? Boolean(body.ativo) : true,
    },
    produtos,
    anexos,
  };
};

const erroValidacao = (error) =>
  error.message.includes("obrigatorio") ||
  error.message.includes("obrigatoria") ||
  error.message.includes("Quantidade") ||
  error.message.includes("Informe");

export const listarFornecedores = async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({
      include: includeFornecedor,
      order: [["nome", "ASC"]],
    });
    res.json(fornecedores);
  } catch (error) {
    console.error("Erro ao listar fornecedores:", error);
    res.status(500).json({ error: "Erro ao listar fornecedores" });
  }
};

export const criarFornecedor = async (req, res) => {
  try {
    const dados = normalizarFornecedor(req.body);
    const fornecedor = await Fornecedor.create(dados.fornecedor);
    await FornecedorProduto.bulkCreate(
      dados.produtos.map((produto) => ({ ...produto, fornecedorId: fornecedor.id })),
    );
    if (dados.anexos.length > 0) {
      await FornecedorAnexo.bulkCreate(
        dados.anexos.map((anexo) => ({ ...anexo, fornecedorId: fornecedor.id })),
      );
    }

    const fornecedorCompleto = await Fornecedor.findByPk(fornecedor.id, {
      include: includeFornecedor,
    });
    res.status(201).json(fornecedorCompleto);
  } catch (error) {
    if (erroValidacao(error)) return res.status(400).json({ error: error.message });
    console.error("Erro ao criar fornecedor:", error);
    res.status(500).json({ error: "Erro ao criar fornecedor" });
  }
};

export const atualizarFornecedor = async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findByPk(req.params.id);
    if (!fornecedor) return res.status(404).json({ error: "Fornecedor nao encontrado" });

    const dados = normalizarFornecedor(req.body);
    await fornecedor.update(dados.fornecedor);
    await FornecedorProduto.destroy({ where: { fornecedorId: fornecedor.id } });
    await FornecedorAnexo.destroy({ where: { fornecedorId: fornecedor.id } });
    await FornecedorProduto.bulkCreate(
      dados.produtos.map((produto) => ({ ...produto, fornecedorId: fornecedor.id })),
    );
    if (dados.anexos.length > 0) {
      await FornecedorAnexo.bulkCreate(
        dados.anexos.map((anexo) => ({ ...anexo, fornecedorId: fornecedor.id })),
      );
    }

    const fornecedorCompleto = await Fornecedor.findByPk(fornecedor.id, {
      include: includeFornecedor,
    });
    res.json(fornecedorCompleto);
  } catch (error) {
    if (erroValidacao(error)) return res.status(400).json({ error: error.message });
    console.error("Erro ao atualizar fornecedor:", error);
    res.status(500).json({ error: "Erro ao atualizar fornecedor" });
  }
};

export const excluirFornecedor = async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findByPk(req.params.id);
    if (!fornecedor) return res.status(404).json({ error: "Fornecedor nao encontrado" });
    await fornecedor.destroy();
    res.json({ message: "Fornecedor removido" });
  } catch (error) {
    console.error("Erro ao remover fornecedor:", error);
    res.status(500).json({ error: "Erro ao remover fornecedor" });
  }
};

export const compararPrecosFornecedores = async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({
      where: { ativo: true },
      include: includeFornecedor,
      order: [["nome", "ASC"]],
    });

    const grupos = new Map();
    fornecedores.forEach((fornecedor) => {
      fornecedor.produtos?.forEach((produto) => {
        const chave = normalizarTexto(produto.produtoNome).toLowerCase();
        if (!chave) return;
        const quantidade = Number(produto.quantidade);
        const preco = Number(produto.preco);
        const precoUnitario = quantidade > 0 ? preco / quantidade : 0;
        const item = {
          fornecedorId: fornecedor.id,
          fornecedorNome: fornecedor.nome,
          produtoId: produto.id,
          produtoNome: produto.produtoNome,
          quantidade,
          unidade: produto.unidade,
          preco,
          precoUnitario,
          cidade: fornecedor.cidade,
          telefoneWhatsapp: fornecedor.telefoneWhatsapp,
        };
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(item);
      });
    });

    const comparacoes = [...grupos.entries()]
      .map(([chave, itens]) => {
        const ordenados = itens.sort((a, b) => a.precoUnitario - b.precoUnitario);
        return {
          produto: ordenados[0]?.produtoNome || chave,
          melhorPrecoUnitario: ordenados[0]?.precoUnitario || 0,
          fornecedores: ordenados,
        };
      })
      .sort((a, b) => a.produto.localeCompare(b.produto));

    res.json(comparacoes);
  } catch (error) {
    console.error("Erro ao comparar fornecedores:", error);
    res.status(500).json({ error: "Erro ao comparar fornecedores" });
  }
};
