import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";

// Catálogo de tipos de máquina (ex: Garra, Poltrona, Takeball), cada um com
// uma capacidade padrão que preenche automaticamente o cadastro/edição de
// máquina — o valor na máquina em si continua editável por fora do catálogo.
const TipoMaquina = sequelize.define(
  "TipoMaquina",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    capacidadePadrao: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      comment: "Quantidade máxima sugerida pra máquinas desse tipo",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "tipos_maquina",
    timestamps: true,
  },
);

export default TipoMaquina;
