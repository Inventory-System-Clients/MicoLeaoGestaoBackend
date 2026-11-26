import { Documento, Usuario, Loja, ProjetoLoja } from "../models/index.js";

// Documentos em PDF de uma loja (contratos) ou de um projeto de loja.
// Rotas: GET/POST /api/lojas/:id/documentos, DELETE .../documentos/:documentoId
// (mesmo para /api/projetos-loja). O PDF já chega enviado ao Cloudinary pelo
// navegador; aqui só aceita link do Cloudinary terminado em .pdf.

const DONOS = {
  LOJA: { model: () => Loja, nome: "Loja" },
  PROJETO_LOJA: { model: () => ProjetoLoja, nome: "Projeto" },
};

const LINK_PDF_CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(raw|image)\/upload\/.+\.pdf$/i;

const responder = (res, status, error) => res.status(status).json({ error });

const buscarDono = async (entidade, id) => DONOS[entidade].model().findByPk(id, { attributes: ["id"] });

export const documentosDe = (entidade) => ({
  async listar(req, res) {
    try {
      const documentos = await Documento.findAll({
        where: { entidade, entidadeId: req.params.id },
        include: [{ model: Usuario, as: "enviadoPor", attributes: ["id", "nome"] }],
        order: [["created_at", "DESC"]],
      });
      res.json(documentos);
    } catch (error) {
      console.error("Erro ao listar documentos:", error);
      responder(res, 500, "Erro ao listar documentos");
    }
  },

  async criar(req, res) {
    try {
      if (!(await buscarDono(entidade, req.params.id))) {
        return responder(res, 404, `${DONOS[entidade].nome} não encontrado(a)`);
      }
      const titulo = String(req.body?.titulo || "").trim();
      const url = String(req.body?.url || "").trim();
      if (!titulo) return responder(res, 400, "Dê um nome ao documento (ex.: Contrato 2026).");
      if (!LINK_PDF_CLOUDINARY.test(url)) return responder(res, 400, "Envie um arquivo PDF.");
      const tamanho = Number(req.body?.tamanho);
      const documento = await Documento.create({
        entidade,
        entidadeId: req.params.id,
        titulo: titulo.slice(0, 150),
        url,
        nomeArquivo: String(req.body?.nomeArquivo || "").trim().slice(0, 255) || null,
        tamanho: Number.isFinite(tamanho) && tamanho > 0 ? Math.round(tamanho) : null,
        enviadoPorId: req.usuario?.id || null,
      });
      res.locals.entityId = documento.id;
      res.status(201).json(
        await Documento.findByPk(documento.id, {
          include: [{ model: Usuario, as: "enviadoPor", attributes: ["id", "nome"] }],
        }),
      );
    } catch (error) {
      console.error("Erro ao salvar documento:", error);
      responder(res, 500, "Erro ao salvar documento");
    }
  },

  // Tira da lista (o arquivo continua no Cloudinary: envio sem chave secreta)
  async excluir(req, res) {
    try {
      const apagados = await Documento.destroy({
        where: { id: req.params.documentoId, entidade, entidadeId: req.params.id },
      });
      if (!apagados) return responder(res, 404, "Documento não encontrado");
      res.json({ message: "Documento removido" });
    } catch (error) {
      console.error("Erro ao remover documento:", error);
      responder(res, 500, "Erro ao remover documento");
    }
  },
});
