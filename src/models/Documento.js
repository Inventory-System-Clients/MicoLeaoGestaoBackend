import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Documentos em PDF (contrato da loja, documentos do projeto de loja...).
// O arquivo fica no Cloudinary (envio direto do navegador); aqui só guarda o
// link, o nome e quem enviou. `entidade` diz de quem é: LOJA ou PROJETO_LOJA.
const Documento = sequelize.define(
  "Documento",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entidade: {
      type: DataTypes.STRING(30),
      allowNull: false,
      comment: "LOJA | PROJETO_LOJA",
    },
    entidadeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "entidade_id",
    },
    titulo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(700),
      allowNull: false,
    },
    nomeArquivo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "nome_arquivo",
    },
    tamanho: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Bytes",
    },
    enviadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "enviado_por_id",
    },
  },
  {
    tableName: "documentos",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [{ fields: ["entidade", "entidade_id"] }],
  },
);

export default Documento;
