import MovimentacaoVeiculo from "./MovimentacaoVeiculo.js";
import GastoVariavel from "./GastoVariavel.js";
import Usuario from "./Usuario.js";
import Loja from "./Loja.js";
import Maquina from "./Maquina.js";
import Produto from "./Produto.js";
import Movimentacao from "./Movimentacao.js";
import MovimentacaoProduto from "./MovimentacaoProduto.js";
import LogAtividade from "./LogAtividade.js";
import UsuarioLoja from "./UsuarioLoja.js";
import EstoqueLoja from "./EstoqueLoja.js";
import MovimentacaoEstoqueLoja from "./MovimentacaoEstoqueLoja.js";
import MovimentacaoEstoqueLojaProduto from "./MovimentacaoEstoqueLojaProduto.js";
import AlertaIgnorado from "./AlertaIgnorado.js";
import Veiculo from "./Veiculo.js";
import RegistroDinheiro from "./RegistroDinheiro.js";
import GastoFixoLoja from "./GastoFixoLoja.js";
import GastoTotalFixoLoja from "./GastoTotalFixoLoja.js";
import FechamentoMensalRelatorio from "./FechamentoMensalRelatorio.js";
import Manutencao from "./Manutencao.js";
import ManutencaoUsuario from "./ManutencaoUsuario.js";
import Sangria from "./Sangria.js";
import AlertaMovimentacao from "./AlertaMovimentacao.js";
import Roteiro from "./Roteiro.js";
import RoteiroItem from "./RoteiroItem.js";
import TreinamentoVideo from "./TreinamentoVideo.js";
import TreinamentoFeedback from "./TreinamentoFeedback.js";
import Fornecedor from "./Fornecedor.js";
import FornecedorProduto from "./FornecedorProduto.js";
import FornecedorAnexo from "./FornecedorAnexo.js";
import DesenvolvimentoSugestao from "./DesenvolvimentoSugestao.js";
import ModoSeguranca from "./ModoSeguranca.js";
import Insumo from "./Insumo.js";
import InsumoCompra from "./InsumoCompra.js";
import PedidoPelucia from "./PedidoPelucia.js";
import Peca from "./Peca.js";
import EstoquePecaFuncionario from "./EstoquePecaFuncionario.js";
import MovimentacaoPeca from "./MovimentacaoPeca.js";
import ManutencaoPeca from "./ManutencaoPeca.js";
import Envio from "./Envio.js";
import Lacre from "./Lacre.js";
import ItemLacre from "./ItemLacre.js";
import Compra from "./Compra.js";
// MovimentaÃ§Ã£o de VeÃ­culo -> VeÃ­culo e UsuÃ¡rio
MovimentacaoVeiculo.belongsTo(Veiculo, {
  as: "veiculo",
  foreignKey: "veiculoId",
});
MovimentacaoVeiculo.belongsTo(Usuario, {
  as: "usuario",
  foreignKey: "usuarioId",
});

// Relacionamentos
MovimentacaoEstoqueLoja.belongsTo(Loja, { foreignKey: "lojaId", as: "loja" });
Loja.hasMany(MovimentacaoEstoqueLoja, {
  foreignKey: "lojaId",
  as: "movimentacoesEstoque",
});

MovimentacaoEstoqueLoja.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});
Usuario.hasMany(MovimentacaoEstoqueLoja, {
  foreignKey: "usuarioId",
  as: "movimentacoesEstoque",
});

// Loja -> MÃ¡quinas
Loja.hasMany(Maquina, { foreignKey: "lojaId", as: "maquinas" });
Maquina.belongsTo(Loja, { foreignKey: "lojaId", as: "loja" });

// MÃ¡quina -> MovimentaÃ§Ãµes
Maquina.hasMany(Movimentacao, { foreignKey: "maquinaId", as: "movimentacoes" });
Movimentacao.belongsTo(Maquina, { foreignKey: "maquinaId", as: "maquina" });

// UsuÃ¡rio -> MovimentaÃ§Ãµes
Usuario.hasMany(Movimentacao, { foreignKey: "usuarioId", as: "movimentacoes" });
Movimentacao.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

// MovimentaÃ§Ã£o <-> Produtos (many-to-many)
Movimentacao.belongsToMany(Produto, {
  through: MovimentacaoProduto,
  foreignKey: "movimentacaoId",
  otherKey: "produtoId",
  as: "produtos",
});

Produto.belongsToMany(Movimentacao, {
  through: MovimentacaoProduto,
  foreignKey: "produtoId",
  otherKey: "movimentacaoId",
  as: "movimentacoes",
});

// Acesso direto Ã  tabela intermediÃ¡ria
Movimentacao.hasMany(MovimentacaoProduto, {
  foreignKey: "movimentacaoId",
  as: "detalhesProdutos",
});
MovimentacaoProduto.belongsTo(Movimentacao, { foreignKey: "movimentacaoId" });
MovimentacaoProduto.belongsTo(Produto, {
  foreignKey: "produtoId",
  as: "produto",
});

// UsuÃ¡rio -> Logs
Usuario.hasMany(LogAtividade, { foreignKey: "usuarioId", as: "logs" });
LogAtividade.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

// UsuÃ¡rio <-> Lojas (RBAC - many-to-many)
Usuario.belongsToMany(Loja, {
  through: UsuarioLoja,
  foreignKey: "usuarioId",
  otherKey: "lojaId",
  as: "lojasPermitidas",
});

Loja.belongsToMany(Usuario, {
  through: UsuarioLoja,
  foreignKey: "lojaId",
  otherKey: "usuarioId",
  as: "usuariosPermitidos",
});

// Acesso direto Ã  tabela UsuarioLoja
Usuario.hasMany(UsuarioLoja, {
  foreignKey: "usuarioId",
  as: "permissoesLojas",
});
Loja.hasMany(UsuarioLoja, { foreignKey: "lojaId", as: "permissoesUsuarios" });
UsuarioLoja.belongsTo(Usuario, { foreignKey: "usuarioId" });
UsuarioLoja.belongsTo(Loja, { foreignKey: "lojaId" });

// Loja <-> Produtos (Estoque - many-to-many)
Loja.belongsToMany(Produto, {
  through: EstoqueLoja,
  foreignKey: "lojaId",
  otherKey: "produtoId",
  as: "estoqueProdutos",
});

Produto.belongsToMany(Loja, {
  through: EstoqueLoja,
  foreignKey: "produtoId",
  otherKey: "lojaId",
  as: "estoqueLoja",
});

// Relacionamento MovimentacaoEstoqueLoja <-> Produto
MovimentacaoEstoqueLoja.hasMany(MovimentacaoEstoqueLojaProduto, {
  foreignKey: "movimentacaoEstoqueLojaId",
  as: "produtosEnviados",
});
MovimentacaoEstoqueLojaProduto.belongsTo(MovimentacaoEstoqueLoja, {
  foreignKey: "movimentacaoEstoqueLojaId",
  as: "movimentacao",
});
MovimentacaoEstoqueLojaProduto.belongsTo(Produto, {
  foreignKey: "produtoId",
  as: "produto",
});
Loja.hasMany(EstoqueLoja, {
  foreignKey: "lojaId",
  as: "estoques",
});
Produto.hasMany(EstoqueLoja, {
  foreignKey: "produtoId",
  as: "estoquesEmLojas",
});
EstoqueLoja.belongsTo(Loja, { foreignKey: "lojaId", as: "loja" });
EstoqueLoja.belongsTo(Produto, { foreignKey: "produtoId", as: "produto" });

Loja.hasMany(GastoFixoLoja, {
  foreignKey: "lojaId",
  sourceKey: "id",
  as: "gastosFixos",
});
GastoFixoLoja.belongsTo(Loja, {
  foreignKey: "lojaId",
  targetKey: "id",
  as: "loja",
});

Loja.hasMany(GastoTotalFixoLoja, {
  foreignKey: "lojaId",
  sourceKey: "id",
  as: "gastosFixosTotaisMensais",
});
GastoTotalFixoLoja.belongsTo(Loja, {
  foreignKey: "lojaId",
  targetKey: "id",
  as: "loja",
});

Loja.hasMany(FechamentoMensalRelatorio, {
  foreignKey: "lojaId",
  sourceKey: "id",
  as: "fechamentosMensaisRelatorio",
});
FechamentoMensalRelatorio.belongsTo(Loja, {
  foreignKey: "lojaId",
  targetKey: "id",
  as: "loja",
});

Usuario.hasMany(FechamentoMensalRelatorio, {
  foreignKey: "fechadoPorUsuarioId",
  sourceKey: "id",
  as: "fechamentosMensaisCriados",
});
FechamentoMensalRelatorio.belongsTo(Usuario, {
  foreignKey: "fechadoPorUsuarioId",
  targetKey: "id",
  as: "fechadoPor",
});

Usuario.hasMany(Manutencao, {
  foreignKey: "criadoPorId",
  as: "manutencoesCriadas",
});
Manutencao.belongsTo(Usuario, {
  foreignKey: "criadoPorId",
  as: "criadoPor",
});

Usuario.hasMany(Manutencao, {
  foreignKey: "resolvidoPorId",
  as: "manutencoesResolvidas",
});
Manutencao.belongsTo(Usuario, {
  foreignKey: "resolvidoPorId",
  as: "resolvidoPor",
});

Manutencao.belongsToMany(Usuario, {
  through: ManutencaoUsuario,
  foreignKey: "manutencaoId",
  otherKey: "usuarioId",
  as: "funcionariosPermitidos",
});

Usuario.belongsToMany(Manutencao, {
  through: ManutencaoUsuario,
  foreignKey: "usuarioId",
  otherKey: "manutencaoId",
  as: "manutencoesPermitidas",
});

Manutencao.hasMany(ManutencaoUsuario, {
  foreignKey: "manutencaoId",
  as: "vinculosUsuarios",
});
ManutencaoUsuario.belongsTo(Manutencao, { foreignKey: "manutencaoId" });
ManutencaoUsuario.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Loja.hasMany(Manutencao, {
  foreignKey: "lojaId",
  as: "manutencoes",
});
Manutencao.belongsTo(Loja, {
  foreignKey: "lojaId",
  as: "loja",
});

Maquina.hasMany(Manutencao, {
  foreignKey: "maquinaId",
  as: "manutencoes",
});
Manutencao.belongsTo(Maquina, {
  foreignKey: "maquinaId",
  as: "maquina",
});

Usuario.hasMany(Manutencao, {
  foreignKey: "responsavelId",
  as: "manutencoesResponsavel",
});
Manutencao.belongsTo(Usuario, {
  foreignKey: "responsavelId",
  as: "responsavel",
});

AlertaMovimentacao.belongsTo(Maquina, {
  foreignKey: "maquinaId",
  as: "maquina",
});
AlertaMovimentacao.belongsTo(Loja, {
  foreignKey: "lojaId",
  as: "loja",
});
AlertaMovimentacao.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});
AlertaMovimentacao.belongsTo(Usuario, {
  foreignKey: "resolvidoPorId",
  as: "resolvidoPor",
});

Loja.hasMany(Sangria, {
  foreignKey: "lojaId",
  as: "sangrias",
});
Sangria.belongsTo(Loja, {
  foreignKey: "lojaId",
  as: "loja",
});

Usuario.hasMany(Sangria, {
  foreignKey: "usuarioId",
  as: "sangriasCriadas",
});
Sangria.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

GastoVariavel.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
GastoVariavel.belongsTo(Veiculo, { foreignKey: "veiculoId", as: "veiculo" });
Usuario.hasMany(GastoVariavel, {
  foreignKey: "usuarioId",
  as: "gastosVariaveis",
});
Veiculo.hasMany(GastoVariavel, {
  foreignKey: "veiculoId",
  as: "gastosVariaveis",
});

Usuario.hasMany(Roteiro, {
  foreignKey: "usuarioId",
  as: "roteiros",
});
Roteiro.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "funcionario",
});

Veiculo.hasMany(Roteiro, {
  foreignKey: "veiculoId",
  as: "roteiros",
});
Roteiro.belongsTo(Veiculo, {
  foreignKey: "veiculoId",
  as: "veiculo",
});

Roteiro.hasMany(RoteiroItem, {
  foreignKey: "roteiroId",
  as: "itens",
  onDelete: "CASCADE",
});
RoteiroItem.belongsTo(Roteiro, {
  foreignKey: "roteiroId",
  as: "roteiro",
});
RoteiroItem.belongsTo(Loja, {
  foreignKey: "lojaId",
  as: "loja",
});
Loja.hasMany(RoteiroItem, {
  foreignKey: "lojaId",
  as: "itensRoteiro",
});

Usuario.hasMany(TreinamentoVideo, {
  foreignKey: "criadoPorId",
  as: "videosTreinamentoCriados",
});
TreinamentoVideo.belongsTo(Usuario, {
  foreignKey: "criadoPorId",
  as: "criadoPor",
});

Usuario.hasMany(TreinamentoFeedback, {
  foreignKey: "usuarioId",
  as: "feedbacksTreinamento",
});
TreinamentoFeedback.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Fornecedor.hasMany(FornecedorProduto, {
  foreignKey: "fornecedorId",
  as: "produtos",
  onDelete: "CASCADE",
});
FornecedorProduto.belongsTo(Fornecedor, {
  foreignKey: "fornecedorId",
  as: "fornecedor",
});

Fornecedor.hasMany(FornecedorAnexo, {
  foreignKey: "fornecedorId",
  as: "anexos",
  onDelete: "CASCADE",
});
FornecedorAnexo.belongsTo(Fornecedor, {
  foreignKey: "fornecedorId",
  as: "fornecedor",
});

Usuario.hasMany(DesenvolvimentoSugestao, {
  foreignKey: "criadoPorId",
  as: "sugestoesDesenvolvimentoCriadas",
});
DesenvolvimentoSugestao.belongsTo(Usuario, {
  foreignKey: "criadoPorId",
  as: "criadoPor",
});
DesenvolvimentoSugestao.belongsTo(Usuario, {
  foreignKey: "respondidoPorId",
  as: "respondidoPor",
});
DesenvolvimentoSugestao.belongsTo(Usuario, {
  foreignKey: "desenvolvidoPorId",
  as: "desenvolvidoPor",
});
DesenvolvimentoSugestao.belongsTo(Usuario, {
  foreignKey: "baixadoPorId",
  as: "baixadoPor",
});

ModoSeguranca.belongsTo(Usuario, {
  foreignKey: "ativadoPorId",
  as: "ativadoPor",
});
ModoSeguranca.belongsTo(Usuario, {
  foreignKey: "desativadoPorId",
  as: "desativadoPor",
});

Insumo.hasMany(InsumoCompra, { foreignKey: "insumoId", as: "compras" });
InsumoCompra.belongsTo(Insumo, { foreignKey: "insumoId", as: "insumo" });
InsumoCompra.belongsTo(Fornecedor, {
  foreignKey: "fornecedorId",
  as: "fornecedor",
});
InsumoCompra.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

Produto.hasMany(PedidoPelucia, {
  foreignKey: "produtoId",
  as: "pedidosPelucia",
});
PedidoPelucia.belongsTo(Produto, { foreignKey: "produtoId", as: "produto" });
PedidoPelucia.belongsTo(Usuario, {
  foreignKey: "criadoPorId",
  as: "criadoPor",
});
PedidoPelucia.belongsTo(Usuario, {
  foreignKey: "concluidoPorId",
  as: "concluidoPor",
});
PedidoPelucia.belongsTo(MovimentacaoEstoqueLoja, {
  foreignKey: "movimentacaoEstoqueLojaId",
  as: "movimentacaoEstoqueLoja",
});

Peca.hasMany(EstoquePecaFuncionario, {
  foreignKey: "pecaId",
  as: "estoquesFuncionarios",
});
EstoquePecaFuncionario.belongsTo(Peca, { foreignKey: "pecaId", as: "peca" });
Usuario.hasMany(EstoquePecaFuncionario, {
  foreignKey: "funcionarioId",
  as: "estoquePecas",
});
EstoquePecaFuncionario.belongsTo(Usuario, {
  foreignKey: "funcionarioId",
  as: "funcionario",
});

Peca.hasMany(MovimentacaoPeca, { foreignKey: "pecaId", as: "envios" });
MovimentacaoPeca.belongsTo(Peca, { foreignKey: "pecaId", as: "peca" });
MovimentacaoPeca.belongsTo(Usuario, {
  foreignKey: "funcionarioId",
  as: "funcionario",
});
MovimentacaoPeca.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "enviadoPor",
});

Manutencao.hasMany(ManutencaoPeca, {
  foreignKey: "manutencaoId",
  as: "pecasUsadas",
});
ManutencaoPeca.belongsTo(Manutencao, {
  foreignKey: "manutencaoId",
  as: "manutencao",
});
ManutencaoPeca.belongsTo(Peca, { foreignKey: "pecaId", as: "peca" });
ManutencaoPeca.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });

Loja.hasMany(Envio, { foreignKey: "lojaDestinoId", as: "enviosRecebidos" });
Envio.belongsTo(Loja, { foreignKey: "lojaDestinoId", as: "lojaDestino" });
Envio.belongsTo(Usuario, { foreignKey: "separadoPorId", as: "separadoPor" });
Envio.belongsTo(Usuario, {
  foreignKey: "transportadorId",
  as: "transportador",
});
Envio.belongsTo(Usuario, {
  foreignKey: "despachadoPorId",
  as: "despachadoPor",
});

Envio.hasMany(Lacre, { foreignKey: "envioId", as: "lacres" });
Lacre.belongsTo(Envio, { foreignKey: "envioId", as: "envio" });
Lacre.belongsTo(Usuario, { foreignKey: "conferidoPorId", as: "conferidoPor" });

Lacre.hasMany(ItemLacre, { foreignKey: "lacreId", as: "itens" });
ItemLacre.belongsTo(Lacre, { foreignKey: "lacreId", as: "lacre" });
ItemLacre.belongsTo(Produto, { foreignKey: "produtoId", as: "produto" });

Compra.belongsTo(Produto, { foreignKey: "produtoId", as: "produto" });
Compra.belongsTo(Insumo, { foreignKey: "insumoId", as: "insumo" });
Compra.belongsTo(Fornecedor, { foreignKey: "fornecedorId", as: "fornecedor" });
Compra.belongsTo(Loja, { foreignKey: "lojaId", as: "loja" });
Compra.belongsTo(Usuario, { foreignKey: "criadoPorId", as: "criadoPor" });
Compra.belongsTo(Usuario, { foreignKey: "compradorId", as: "comprador" });
Compra.belongsTo(Usuario, { foreignKey: "recebidoPorId", as: "recebidoPor" });

RegistroDinheiro.belongsTo(Loja, { foreignKey: "lojaId", as: "loja" });
RegistroDinheiro.belongsTo(Maquina, { foreignKey: "maquinaId", as: "maquina" });
RegistroDinheiro.belongsTo(Usuario, {
  foreignKey: "contadoPorId",
  as: "contadoPor",
});
RegistroDinheiro.belongsTo(Usuario, {
  foreignKey: "conferidoPorId",
  as: "conferidoPor",
});

export {
  Usuario,
  Loja,
  Maquina,
  Produto,
  Movimentacao,
  MovimentacaoProduto,
  LogAtividade,
  UsuarioLoja,
  EstoqueLoja,
  MovimentacaoEstoqueLoja,
  MovimentacaoEstoqueLojaProduto,
  AlertaIgnorado,
  Veiculo,
  MovimentacaoVeiculo,
  RegistroDinheiro,
  GastoVariavel,
  GastoFixoLoja,
  GastoTotalFixoLoja,
  FechamentoMensalRelatorio,
  Manutencao,
  ManutencaoUsuario,
  Sangria,
  AlertaMovimentacao,
  Roteiro,
  RoteiroItem,
  TreinamentoVideo,
  TreinamentoFeedback,
  Fornecedor,
  FornecedorProduto,
  FornecedorAnexo,
  DesenvolvimentoSugestao,
  ModoSeguranca,
  Insumo,
  InsumoCompra,
  PedidoPelucia,
  Peca,
  EstoquePecaFuncionario,
  MovimentacaoPeca,
  ManutencaoPeca,
  Envio,
  Lacre,
  ItemLacre,
  Compra,
};

