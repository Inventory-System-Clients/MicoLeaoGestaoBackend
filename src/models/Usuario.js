import { DataTypes } from "sequelize";
import { sequelize } from "../database/connection.js";
import bcrypt from "bcryptjs";

const Usuario = sequelize.define(
  "Usuario",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    senha: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM(
        "ADMIN",
        "FUNCIONARIO",
        "DESENVOLVEDOR",
        "FUNCIONARIO_ESTOQUE",
        "FUNCIONARIO_CADASTRO",
        "CONSULTOR_VENDAS",
        "MOTORISTA",
        "ABASTECEDOR",
        "FINANCEIRO",
        "GERENTE_VENDAS",
      ),
      allowNull: false,
      defaultValue: "FUNCIONARIO",
    },
    telefone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    acessosPersonalizados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "acessos_personalizados",
      comment:
        "Ajustes de acesso do usuário sobre o padrão do perfil: { adicionadas: [chaves], removidas: [chaves] } (ver src/permissoes)",
    },
    jornadaDiariaMinutos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 480,
      field: "jornada_diaria_minutos",
      comment: "Jornada do dia em minutos (ponto): passou disso, conta hora extra",
    },
    // Ponto: escala (DIARIA: dias da semana em diasTrabalho; 12X36: dia sim,
    // dia não a partir de escalaInicio), salário (valor da hora extra) e
    // valor da diária (vazio = salário ÷ 30)
    escala: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "DIARIA",
    },
    diasTrabalho: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [1, 2, 3, 4, 5, 6],
      field: "dias_trabalho",
    },
    escalaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "escala_inicio",
    },
    salario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    valorDiaria: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: "valor_diaria",
    },
    // Chefe do setor (perfil): na manutenção mandada para o setor, escolhe
    // quem faz (ou faz ele mesmo)
    chefeSetor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "chefe_setor",
    },
  },
  {
    tableName: "usuarios",
    timestamps: true,
    hooks: {
      beforeCreate: async (usuario) => {
        if (usuario.senha) {
          usuario.senha = await bcrypt.hash(usuario.senha, 10);
        }
      },
      beforeUpdate: async (usuario) => {
        if (usuario.changed("senha")) {
          usuario.senha = await bcrypt.hash(usuario.senha, 10);
        }
      },
    },
  }
);

// Método para verificar senha
Usuario.prototype.verificarSenha = async function (senha) {
  return await bcrypt.compare(senha, this.senha);
};

// Método para esconder senha ao serializar
Usuario.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.senha;
  return values;
};

export default Usuario;
