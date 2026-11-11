// Padrão de nome de produtos, insumos e peças:
// - salvo em MAIÚSCULO, sem espaços nas pontas e sem espaços duplicados;
// - não pode repetir. A comparação ignora maiúsculas, acentos e espaços extras.
// Duplicados antigos (de antes dessa regra) continuam no banco e podem ser
// editados normalmente; a trava só pega cadastro novo ou troca de nome.

export const normalizarNome = (nome) =>
  typeof nome === "string"
    ? nome.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR")
    : nome;

export const chaveNome = (nome) =>
  normalizarNome(String(nome ?? ""))
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Retorna o registro que já usa esse nome (ativo ou inativo), ou null.
// As tabelas são pequenas (centenas de linhas), então a comparação é feita em JS
// para não depender da extensão unaccent no Postgres.
export const buscarNomeRepetido = async (Model, nome, { ignorarId, transaction } = {}) => {
  const chave = chaveNome(nome);
  if (!chave) return null;
  const registros = await Model.findAll({
    attributes: ["id", "nome", "ativo"],
    transaction,
  });
  return (
    registros.find((r) => r.id !== ignorarId && chaveNome(r.nome) === chave) || null
  );
};

export const mensagemNomeRepetido = (rotulo, existente) =>
  `Já existe ${rotulo} com o nome "${existente.nome}"` +
  (existente.ativo === false
    ? " (está desativado — reative-o em vez de cadastrar de novo)"
    : ". Use o cadastro existente ou escolha outro nome.");
