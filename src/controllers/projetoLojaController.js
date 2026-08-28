import { sequelize } from "../database/connection.js";
import {
  ProjetoLoja,
  ProjetoLojaMaquina,
  ProjetoLojaCusto,
  Loja,
  Maquina,
  Usuario,
} from "../models/index.js";

const includeProjeto = [
  { model: Loja, as: "loja", attributes: ["id", "nome"] },
  { model: Usuario, as: "criadoPor", attributes: ["id", "nome"] },
  {
    model: ProjetoLojaMaquina,
    as: "maquinas",
    include: [{ model: Maquina, as: "maquina", attributes: ["id", "codigo", "nome"] }],
  },
  { model: ProjetoLojaCusto, as: "custos" },
];

const normalizarValor = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 0 ? numero : 0;
};

const normalizarMaquinas = (maquinas) => {
  if (!Array.isArray(maquinas)) return [];

  return maquinas
    .map((item) => ({
      nome: String(item?.nome || "").trim(),
      maquinaId: item?.maquinaId || null,
      tipo: item?.maquinaId ? null : item?.tipo ? String(item.tipo).trim() : null,
      quantidade: item?.maquinaId ? 1 : Math.max(1, parseInt(item?.quantidade, 10) || 1),
      custoUnitario: normalizarValor(item?.custoUnitario),
      observacao: item?.observacao ? String(item.observacao).trim() : null,
    }))
    .filter((item) => item.nome.length > 0)
    .map((item) => ({
      ...item,
      custoTotal: Number((item.quantidade * item.custoUnitario).toFixed(2)),
    }));
};

const normalizarCustos = (custos) => {
  if (!Array.isArray(custos)) return [];

  return custos
    .map((item) => ({
      categoria: String(item?.categoria || "").trim(),
      descricao: item?.descricao ? String(item.descricao).trim() : null,
      valor: normalizarValor(item?.valor),
    }))
    .filter((item) => item.categoria.length > 0);
};

const calcularTotalInvestido = (projeto) => {
  const totalMaquinas = (projeto.maquinas || []).reduce(
    (acc, item) => acc + Number(item.custoTotal || 0),
    0,
  );
  const totalCustos = (projeto.custos || []).reduce(
    (acc, item) => acc + Number(item.valor || 0),
    0,
  );
  return Number((totalMaquinas + totalCustos).toFixed(2));
};

const projetoComTotal = (projeto) => {
  const dados = projeto.toJSON ? projeto.toJSON() : projeto;
  return { ...dados, totalInvestido: calcularTotalInvestido(dados) };
};

const projetoLojaController = {
  async listar(req, res) {
    try {
      const projetos = await ProjetoLoja.findAll({
        include: includeProjeto,
        order: [["createdAt", "DESC"]],
      });

      return res.json(projetos.map(projetoComTotal));
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao listar projetos de loja",
        details: err.message,
      });
    }
  },

  async obter(req, res) {
    try {
      const projeto = await ProjetoLoja.findByPk(req.params.id, {
        include: includeProjeto,
      });

      if (!projeto) {
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      return res.json(projetoComTotal(projeto));
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao buscar projeto de loja",
        details: err.message,
      });
    }
  },

  async criar(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const {
        nome,
        lojaId,
        status,
        dataPrevisaoAbertura,
        observacoes,
        maquinas,
        custos,
      } = req.body;

      if (!nome || !String(nome).trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: "Informe o nome do projeto." });
      }

      const projeto = await ProjetoLoja.create(
        {
          nome: String(nome).trim(),
          lojaId: lojaId || null,
          status: status || "PLANEJAMENTO",
          dataPrevisaoAbertura: dataPrevisaoAbertura || null,
          observacoes: observacoes || null,
          criadoPorId: req.usuario.id,
        },
        { transaction },
      );

      const maquinasNormalizadas = normalizarMaquinas(maquinas);
      if (maquinasNormalizadas.length > 0) {
        await ProjetoLojaMaquina.bulkCreate(
          maquinasNormalizadas.map((item) => ({
            ...item,
            projetoLojaId: projeto.id,
          })),
          { transaction },
        );
      }

      const custosNormalizados = normalizarCustos(custos);
      if (custosNormalizados.length > 0) {
        await ProjetoLojaCusto.bulkCreate(
          custosNormalizados.map((item) => ({
            ...item,
            projetoLojaId: projeto.id,
          })),
          { transaction },
        );
      }

      await transaction.commit();

      const projetoCompleto = await ProjetoLoja.findByPk(projeto.id, {
        include: includeProjeto,
      });
      return res.status(201).json(projetoComTotal(projetoCompleto));
    } catch (err) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Erro ao criar projeto de loja",
        details: err.message,
      });
    }
  },

  async atualizar(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const projeto = await ProjetoLoja.findByPk(req.params.id, { transaction });
      if (!projeto) {
        await transaction.rollback();
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      const {
        nome,
        lojaId,
        status,
        dataPrevisaoAbertura,
        observacoes,
        maquinas,
        custos,
      } = req.body;

      if (!nome || !String(nome).trim()) {
        await transaction.rollback();
        return res.status(400).json({ error: "Informe o nome do projeto." });
      }

      await projeto.update(
        {
          nome: String(nome).trim(),
          lojaId: lojaId || null,
          status: status || projeto.status,
          dataPrevisaoAbertura: dataPrevisaoAbertura || null,
          observacoes: observacoes || null,
        },
        { transaction },
      );

      await ProjetoLojaMaquina.destroy({
        where: { projetoLojaId: projeto.id },
        transaction,
      });
      const maquinasNormalizadas = normalizarMaquinas(maquinas);
      if (maquinasNormalizadas.length > 0) {
        await ProjetoLojaMaquina.bulkCreate(
          maquinasNormalizadas.map((item) => ({
            ...item,
            projetoLojaId: projeto.id,
          })),
          { transaction },
        );
      }

      await ProjetoLojaCusto.destroy({
        where: { projetoLojaId: projeto.id },
        transaction,
      });
      const custosNormalizados = normalizarCustos(custos);
      if (custosNormalizados.length > 0) {
        await ProjetoLojaCusto.bulkCreate(
          custosNormalizados.map((item) => ({
            ...item,
            projetoLojaId: projeto.id,
          })),
          { transaction },
        );
      }

      await transaction.commit();

      const projetoCompleto = await ProjetoLoja.findByPk(projeto.id, {
        include: includeProjeto,
      });
      return res.json(projetoComTotal(projetoCompleto));
    } catch (err) {
      await transaction.rollback();
      return res.status(500).json({
        error: "Erro ao atualizar projeto de loja",
        details: err.message,
      });
    }
  },

  async excluir(req, res) {
    try {
      const projeto = await ProjetoLoja.findByPk(req.params.id);
      if (!projeto) {
        return res.status(404).json({ error: "Projeto não encontrado" });
      }

      await projeto.destroy();
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({
        error: "Erro ao excluir projeto de loja",
        details: err.message,
      });
    }
  },
};

export default projetoLojaController;
