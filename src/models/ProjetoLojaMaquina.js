import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const ProjetoLojaMaquina = sequelize.define(
  "ProjetoLojaMaquina",
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
      comment:
        "Presente = máquina já existe no catálogo. Nulo = máquina futura, ainda a comprar.",
    },
    nome: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Só relevante pra máquina a comprar (ex: Agarra Mais, TakeBall)",
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "Só faz sentido > 1 quando maquinaId é nulo (compra futura em lote)",
    },
    custoUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    custoTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "quantidade * custoUnitario, recalculado no backend",
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "projeto_loja_maquinas",
    timestamps: true,
  },
);

export default ProjetoLojaMaquina;
