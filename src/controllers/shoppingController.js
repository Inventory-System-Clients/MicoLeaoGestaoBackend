import { Shopping, Loja, Maquina } from "../models/index.js";
import { whereSemLojaDeProjeto } from "../utils/lojaProjeto.js";

// Shoppings (Cadastros > Shoppings): agrupam lojas e máquinas avulsas
// (Loja com tipo AVULSA: ponto de uma máquina só, solto no shopping).

const CAMPOS = ["nome", "endereco", "cidade", "estado", "observacoes"];

const limpar = (corpo) => {
  const dados = {};
  for (const campo of CAMPOS) {
    if (corpo[campo] === undefined) continue;
    const valor = String(corpo[campo] ?? "").trim();
    dados[campo] = valor || null;
  }
  if (dados.estado) dados.estado = dados.estado.slice(0, 2).toUpperCase();
  return dados;
};

const incluirConteudo = [
  {
    model: Loja,
    as: "lojas",
    attributes: ["id", "nome", "ativo", "tipo", "estoqueLojaId"],
    where: whereSemLojaDeProjeto,
    required: false,
    include: [
      {
        model: Maquina,
        as: "maquinas",
        attributes: ["id", "codigo", "nome", "ativo", "statusOperacao"],
        required: false,
      },
    ],
  },
];

export const listarShoppings = async (req, res) => {
  try {
    const where = req.query.inativos === "true" ? {} : { ativo: true };
    const shoppings = await Shopping.findAll({
      where,
      include: incluirConteudo,
      order: [["nome", "ASC"]],
    });
    res.json(shoppings);
  } catch (error) {
    console.error("Erro ao listar shoppings:", error);
    res.status(500).json({ error: "Erro ao listar shoppings" });
  }
};

export const obterShopping = async (req, res) => {
  try {
    const shopping = await Shopping.findByPk(req.params.id, { include: incluirConteudo });
    if (!shopping) return res.status(404).json({ error: "Shopping não encontrado" });
    res.json(shopping);
  } catch (error) {
    console.error("Erro ao obter shopping:", error);
    res.status(500).json({ error: "Erro ao obter shopping" });
  }
};

export const criarShopping = async (req, res) => {
  try {
    const dados = limpar(req.body || {});
    if (!dados.nome) return res.status(400).json({ error: "Nome do shopping é obrigatório" });
    const shopping = await Shopping.create(dados);
    res.locals.entityId = shopping.id;
    res.status(201).json(shopping);
  } catch (error) {
    console.error("Erro ao criar shopping:", error);
    res.status(500).json({ error: "Erro ao criar shopping" });
  }
};

export const atualizarShopping = async (req, res) => {
  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) return res.status(404).json({ error: "Shopping não encontrado" });
    const dados = limpar(req.body || {});
    if ("nome" in dados && !dados.nome) {
      return res.status(400).json({ error: "Nome do shopping é obrigatório" });
    }
    if (req.body?.ativo !== undefined) dados.ativo = Boolean(req.body.ativo);
    await shopping.update(dados);
    res.json(shopping);
  } catch (error) {
    console.error("Erro ao atualizar shopping:", error);
    res.status(500).json({ error: "Erro ao atualizar shopping" });
  }
};

// Desativa. Só apaga de vez se já estiver desativado e não tiver nada dentro.
export const deletarShopping = async (req, res) => {
  try {
    const shopping = await Shopping.findByPk(req.params.id);
    if (!shopping) return res.status(404).json({ error: "Shopping não encontrado" });

    if (shopping.ativo) {
      await shopping.update({ ativo: false });
      return res.json({ message: "Shopping desativado" });
    }

    const pontos = await Loja.count({ where: { shoppingId: shopping.id } });
    if (pontos) {
      return res.status(400).json({
        error: `Este shopping ainda tem ${pontos} loja(s)/máquina(s) avulsa(s). Tire do shopping antes de excluir.`,
      });
    }
    await shopping.destroy();
    res.json({ message: "Shopping excluído" });
  } catch (error) {
    console.error("Erro ao excluir shopping:", error);
    res.status(500).json({ error: "Erro ao excluir shopping" });
  }
};
