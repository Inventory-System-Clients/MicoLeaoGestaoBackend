import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

const RegistroDinheiro = sequelize.define(
  "RegistroDinheiro",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    maquinaId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    registrarTotalLoja: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    inicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fim: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    valorDinheiro: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    valorCartaoPix: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    valorCartaoPixLiquido: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    taxaDeCartao: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    percentualTaxaCartaoMedia: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },
    gastoFixoPeriodo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "gasto_fixo_periodo",
    },
    gastoVariavelPeriodo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "gasto_variavel_periodo",
    },
    gastoProdutosPeriodo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "gasto_produtos_periodo",
    },
    gastoTotalPeriodo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "gasto_total_periodo",
    },
    observacoes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    valorBlink: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: "Valor manual da maquininha Blink",
    },
    valorEsperadoSistema: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Fichas das movimentações do período x valor da ficha",
    },
    diferenca: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Valor contado (dinheiro+cartão/pix) - valor esperado pelo sistema",
    },
    diferencaBlink: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment:
        "(Dinheiro+cartão/pix) - Blink, só para registro de total da loja. Blink é só comparação, não entra no valor contado.",
    },
    alertaBlinkResolvidoEm: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    alertaBlinkResolvidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    contadoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    conferidoPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    comprovanteUrl: {
      type: DataTypes.STRING(700),
      allowNull: true,
    },
  },
  {
    tableName: "registro_dinheiro",
    timestamps: true,
  },
);

export default RegistroDinheiro;
