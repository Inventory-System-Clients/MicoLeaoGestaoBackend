import { Usuario, UsuarioLoja, Loja } from "../models/index.js";
import { Op } from "sequelize";

const permissoesPadraoFuncionario = {
  visualizar: true,
  editar: false,
  registrarMovimentacao: true,
};

const obterLojasPermitidasPorRole = async (role, lojasPermitidas = []) => {
  if (role === "FUNCIONARIO_ESTOQUE") {
    const lojas = await Loja.findAll({ attributes: ["id"] });
    return lojas.map((loja) => loja.id);
  }

  if (role === "FUNCIONARIO") {
    return lojasPermitidas;
  }

  return [];
};

const salvarPermissoesLojas = async (usuarioId, lojaIds) => {
  if (!lojaIds.length) return;

  await UsuarioLoja.bulkCreate(
    lojaIds.map((lojaId) => ({
      usuarioId,
      lojaId,
      permissoes: permissoesPadraoFuncionario,
    })),
  );
};

// Listar todos os usuários (apenas ADMIN)
export const listarUsuarios = async (req, res) => {
  try {
    const { role, ativo, busca } = req.query;
    const where = {};

    if (role) {
      where.role = role;
    }

    if (ativo !== undefined) {
      where.ativo = ativo === "true";
    }

    if (busca) {
      where[Op.or] = [
        { nome: { [Op.iLike]: `%${busca}%` } },
        { email: { [Op.iLike]: `%${busca}%` } },
      ];
    }

    const usuarios = await Usuario.findAll({
      where,
      include: [
        {
          model: UsuarioLoja,
          as: "permissoesLojas",
          include: [
            {
              model: Loja,
              attributes: ["id", "nome"],
            },
          ],
        },
      ],
      order: [["nome", "ASC"]],
    });

    res.json(usuarios);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
};

// Obter usuário por ID (apenas ADMIN)
export const obterUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      include: [
        {
          model: UsuarioLoja,
          as: "permissoesLojas",
          include: [
            {
              model: Loja,
              attributes: ["id", "nome"],
            },
          ],
        },
      ],
    });

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    res.json(usuario);
  } catch (error) {
    console.error("Erro ao obter usuário:", error);
    res.status(500).json({ error: "Erro ao obter usuário" });
  }
};

// Criar novo usuário (apenas ADMIN)
export const criarUsuario = async (req, res) => {
  try {
    const { nome, email, senha, telefone, role, lojasPermitidas } = req.body;

    if (!nome || !email || !senha) {
      return res
        .status(400)
        .json({ error: "Nome, email e senha são obrigatórios" });
    }

    // Verificar se email já existe
    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ error: "Email já cadastrado" });
    }

    // Validar role
    const roleValida = [
      "ADMIN",
      "FUNCIONARIO",
      "DESENVOLVEDOR",
      "FUNCIONARIO_ESTOQUE",
      "ENTREGADOR",
      "FUNCIONARIO_CADASTRO",
    ].includes(role);
    if (!roleValida) {
      return res.status(400).json({
        error:
          "Role invalida. Use ADMIN, FUNCIONARIO, DESENVOLVEDOR, FUNCIONARIO_ESTOQUE, ENTREGADOR ou FUNCIONARIO_CADASTRO",
      });
    }

    // Criar usuário
    const usuario = await Usuario.create({
      nome,
      email,
      senha,
      telefone,
      role,
    });

    const lojasParaPermitir = await obterLojasPermitidasPorRole(
      role,
      lojasPermitidas,
    );
    await salvarPermissoesLojas(usuario.id, lojasParaPermitir);

    // Buscar usuário completo com permissões
    const usuarioCompleto = await Usuario.findByPk(usuario.id, {
      include: [
        {
          model: UsuarioLoja,
          as: "permissoesLojas",
          include: [
            {
              model: Loja,
              attributes: ["id", "nome"],
            },
          ],
        },
      ],
    });

    res.locals.entityId = usuario.id;
    res.status(201).json(usuarioCompleto);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
};

// Atualizar usuário (apenas ADMIN)
export const atualizarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const { nome, email, senha, telefone, role, ativo, lojasPermitidas } =
      req.body;

    // Verificar se novo email já existe em outro usuário
    if (email && email !== usuario.email) {
      const emailExistente = await Usuario.findOne({ where: { email } });
      if (emailExistente) {
        return res.status(400).json({ error: "Email já cadastrado" });
      }
    }

    // Validar role se fornecida
    if (
      role &&
      ![
        "ADMIN",
        "FUNCIONARIO",
        "DESENVOLVEDOR",
        "FUNCIONARIO_ESTOQUE",
        "ENTREGADOR",
        "FUNCIONARIO_CADASTRO",
      ].includes(role)
    ) {
      return res.status(400).json({
        error:
          "Role invalida. Use ADMIN, FUNCIONARIO, DESENVOLVEDOR, FUNCIONARIO_ESTOQUE, ENTREGADOR ou FUNCIONARIO_CADASTRO",
      });
    }

    // Atualizar dados básicos
    await usuario.update({
      nome: nome ?? usuario.nome,
      email: email ?? usuario.email,
      senha: senha ?? usuario.senha, // O hook beforeUpdate fará o hash se mudou
      telefone: telefone ?? usuario.telefone,
      role: role ?? usuario.role,
      ativo: ativo ?? usuario.ativo,
    });

    const roleFinal = role || usuario.role;

    // Se mudou para FUNCIONARIO_ESTOQUE ou atualizou lojas permitidas
    if (roleFinal === "FUNCIONARIO_ESTOQUE" || lojasPermitidas !== undefined) {
      // Remover permissões antigas
      await UsuarioLoja.destroy({ where: { usuarioId: usuario.id } });

      const lojasParaPermitir = await obterLojasPermitidasPorRole(
        roleFinal,
        lojasPermitidas,
      );
      await salvarPermissoesLojas(usuario.id, lojasParaPermitir);
    }

    // Buscar usuário atualizado com permissões
    const usuarioAtualizado = await Usuario.findByPk(usuario.id, {
      include: [
        {
          model: UsuarioLoja,
          as: "permissoesLojas",
          include: [
            {
              model: Loja,
              attributes: ["id", "nome"],
            },
          ],
        },
      ],
    });

    res.json(usuarioAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
};

// Deletar usuário (apenas ADMIN)
export const deletarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // Não permitir deletar a si mesmo
    if (usuario.id === req.usuario.id) {
      return res
        .status(400)
        .json({ error: "Você não pode deletar sua própria conta" });
    }

    // Segunda tentativa: usuário já estava inativo -> exclusão definitiva
    if (!usuario.ativo) {
      try {
        await usuario.destroy();
        return res.json({ message: "Usuário excluído permanentemente" });
      } catch (erroDestroy) {
        if (erroDestroy.name === "SequelizeForeignKeyConstraintError") {
          return res.status(400).json({
            error:
              "Não é possível excluir: esse usuário tem histórico vinculado no sistema (movimentações, roteiros, registros de dinheiro etc). Ele pode continuar desativado.",
          });
        }
        throw erroDestroy;
      }
    }

    // Primeira tentativa: soft delete (desativar)
    await usuario.update({ ativo: false });

    res.json({ message: "Usuário desativado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
};

// Reativar usuário (apenas ADMIN)
export const reativarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    await usuario.update({ ativo: true });

    res.json({ message: "Usuário reativado com sucesso", usuario });
  } catch (error) {
    console.error("Erro ao reativar usuário:", error);
    res.status(500).json({ error: "Erro ao reativar usuário" });
  }
};
