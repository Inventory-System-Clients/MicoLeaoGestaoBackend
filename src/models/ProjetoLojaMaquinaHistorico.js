import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Registro de cada máquina que entrou ou saiu da loja enquanto o projeto
// estava aberto. Depois de concluído, o projeto não recebe mais registros.
const ProjetoLojaMaquinaHistorico = sequelize.define(
  "ProjetoLojaMaquinaHistorico",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projetoLojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "projetos_loja",
        key: "id",
      },
    },
    maquinaId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "maquinas",
        key: "id",
      },
    },
    maquinaNome: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: "Nome/código da máquina no momento do registro",
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "ENTRADA | SAIDA | INFO",
    },
    detalhe: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    data: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Dia da movimentação (data da transferência, quando houver)",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
  },
  {
    tableName: "projeto_loja_maquina_historico",
    timestamps: true,
  },
);

export default ProjetoLojaMaquinaHistorico;
