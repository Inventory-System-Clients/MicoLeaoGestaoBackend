// Catálogo de ações do sistema: cada ação liga/desliga um conjunto de rotas
// da API ("MÉTODO /api/caminho", com :parametros como no Express) e,
// opcionalmente, telas do frontend (caminhos do React Router).
//
// Regras (conferidas por `npm run verificar:permissoes`):
// - toda rota autenticada da API está em exatamente uma ação;
// - as rotas de uma mesma ação têm hoje os mesmos perfis com acesso
//   (assim o padrão de cada perfil fica idêntico ao comportamento atual);
// - ação só de tela (sem rotas) informa `perfisPadrao` (quem vê a tela hoje).
//
// Campos opcionais:
//   somenteAdmin: não pode ser dada a quem não é Admin (ex.: gerenciar usuários)
//   requer: outras ações que precisam vir junto (a tela marca sozinha)
//   capacidade: ação sem rota própria, conferida dentro do controller com
//     temAcao(usuario, chave) (ex.: ver valores em R$). Usa `perfisPadrao`.
//   limites: restrições que dá pra pôr em quem tem a ação (aplicadas dentro
//     da consulta, ver permissoes/limites.js). Tipos:
//       "dias" -> número de dias (vazio = sem limite)
//       "sim"  -> liga/desliga
//     Sem limite configurado, vale tudo (como sempre foi).

// Limites reaproveitados
const LIMITE_DIAS = { chave: "dias", tipo: "dias", nome: "Só dos últimos N dias" };
export const CATALOGO = [
  {
    area: "dashboard",
    nome: "Início",
    acoes: [
      {
        chave: "dashboard.ver",
        nome: "Ver o Dashboard (tela inicial)",
        telas: ["/"],
        perfisPadrao: ["FUNCIONARIO", "FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"],
      },
    ],
  },
  {
    area: "lojas",
    nome: "Lojas",
    acoes: [
      {
        chave: "lojas.ver",
        nome: "Ver lojas",
        rotas: ["GET /api/lojas", "GET /api/lojas/:id"],
        telas: ["/lojas", "/lojas/:id"],
      },
      {
        chave: "lojas.criar",
        nome: "Cadastrar loja",
        rotas: ["POST /api/lojas"],
        telas: ["/lojas/nova"],
        requer: ["lojas.ver"],
      },
      {
        chave: "lojas.editar",
        nome: "Editar loja",
        rotas: ["PUT /api/lojas/:id"],
        telas: ["/lojas/:id/editar"],
        requer: ["lojas.ver"],
      },
      { chave: "lojas.excluir", nome: "Excluir loja", rotas: ["DELETE /api/lojas/:id"] },
      {
        chave: "lojas.visaoGeral",
        nome: "Ver painel Visão de Lojas",
        telas: ["/visao-lojas"],
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["lojas.ver"],
      },
      {
        chave: "lojas.todas",
        nome: "Ver e conferir lacre de todas as lojas (não só as autorizadas)",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO_ESTOQUE"],
      },
      {
        chave: "lojas.gastosFixosVer",
        nome: "Ver gastos fixos da loja",
        rotas: ["GET /api/gastos-fixos-loja/:lojaId"],
      },
      {
        chave: "lojas.gastosFixosSalvar",
        nome: "Lançar/editar gastos fixos da loja",
        rotas: ["POST /api/gastos-fixos-loja/:lojaId"],
        requer: ["lojas.gastosFixosVer"],
      },
      {
        chave: "lojas.extintoresVer",
        nome: "Ver extintores da loja",
        rotas: ["GET /api/extintores-loja/:lojaId"],
      },
      {
        chave: "lojas.extintoresSalvar",
        nome: "Lançar/editar extintores da loja",
        rotas: ["POST /api/extintores-loja/:lojaId"],
        requer: ["lojas.extintoresVer"],
      },
    ],
  },
  {
    area: "projetosLoja",
    nome: "Projetos de Loja",
    acoes: [
      {
        chave: "projetosLoja.ver",
        nome: "Ver projetos de loja",
        rotas: ["GET /api/projetos-loja", "GET /api/projetos-loja/:id"],
        telas: ["/projetos-loja"],
      },
      {
        chave: "projetosLoja.criar",
        nome: "Criar projeto de loja",
        rotas: ["POST /api/projetos-loja"],
        telas: ["/projetos-loja/novo"],
        requer: ["projetosLoja.ver"],
      },
      {
        chave: "projetosLoja.editar",
        nome: "Editar projeto de loja",
        rotas: ["PUT /api/projetos-loja/:id"],
        telas: ["/projetos-loja/:id/editar"],
        requer: ["projetosLoja.ver"],
      },
      {
        chave: "projetosLoja.concluir",
        nome: "Concluir projeto (loja vira real)",
        rotas: ["POST /api/projetos-loja/:id/concluir"],
        requer: ["projetosLoja.editar"],
      },
      {
        chave: "projetosLoja.excluir",
        nome: "Excluir projeto de loja",
        rotas: ["DELETE /api/projetos-loja/:id"],
      },
    ],
  },
  {
    area: "maquinas",
    nome: "Máquinas",
    acoes: [
      {
        chave: "maquinas.ver",
        nome: "Ver máquinas",
        rotas: [
          "GET /api/maquinas",
          "GET /api/maquinas/:id",
          "GET /api/maquinas/:id/estoque",
          "GET /api/maquinas/:id/produto-sugerido",
          "GET /api/maquinas/:id/problema",
          "GET /api/maquinas/:id/transferencias",
        ],
        telas: ["/maquinas", "/maquinas/:id"],
      },
      {
        chave: "maquinas.criar",
        nome: "Cadastrar máquina",
        rotas: ["POST /api/maquinas"],
        telas: ["/maquinas/nova"],
        requer: ["maquinas.ver"],
      },
      {
        chave: "maquinas.editar",
        nome: "Editar máquina",
        rotas: ["PUT /api/maquinas/:id"],
        telas: ["/maquinas/:id/editar"],
        requer: ["maquinas.ver"],
      },
      {
        chave: "maquinas.transferir",
        nome: "Transferir máquina de loja",
        rotas: ["POST /api/maquinas/:id/transferir"],
        requer: ["maquinas.ver"],
      },
      { chave: "maquinas.excluir", nome: "Excluir máquina", rotas: ["DELETE /api/maquinas/:id"] },
      {
        chave: "maquinas.visaoGeral",
        // Desde 2026-11-11 é a lista de máquinas do menu (a antiga /maquinas redireciona pra cá)
        nome: "Ver lista de máquinas (Visão das Máquinas)",
        telas: ["/visao-maquinas"],
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["maquinas.ver"],
      },
      {
        chave: "maquinas.auditoria",
        nome: "Ver tela de Auditoria de Máquinas",
        telas: ["/auditoria-maquinas"],
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["maquinas.ver"],
      },
      {
        chave: "maquinas.relatorioTransferencias",
        nome: "Ver relatório de transferências de máquinas",
        rotas: ["GET /api/relatorios/transferencias-maquinas"],
        telas: ["/relatorios/transferencias-maquinas"],
      },
      { chave: "tiposMaquina.ver", nome: "Ver tipos de máquina", rotas: ["GET /api/tipos-maquina"] },
      {
        chave: "tiposMaquina.criar",
        nome: "Cadastrar tipo de máquina",
        rotas: ["POST /api/tipos-maquina"],
      },
      {
        chave: "tiposMaquina.editar",
        nome: "Editar tipo de máquina",
        rotas: ["PUT /api/tipos-maquina/:id"],
      },
      {
        chave: "tiposMaquina.excluir",
        nome: "Excluir tipo de máquina",
        rotas: ["DELETE /api/tipos-maquina/:id"],
      },
    ],
  },
  {
    area: "produtos",
    nome: "Produtos",
    acoes: [
      {
        chave: "produtos.ver",
        nome: "Ver produtos",
        rotas: ["GET /api/produtos", "GET /api/produtos/categorias", "GET /api/produtos/:id"],
        telas: ["/produtos"],
      },
      {
        chave: "produtos.criar",
        nome: "Cadastrar produto",
        rotas: ["POST /api/produtos"],
        telas: ["/produtos/novo"],
        requer: ["produtos.ver"],
      },
      {
        chave: "produtos.editar",
        nome: "Editar produto",
        rotas: ["PUT /api/produtos/:id"],
        telas: ["/produtos/:id/editar"],
        requer: ["produtos.ver"],
      },
      { chave: "produtos.excluir", nome: "Excluir produto", rotas: ["DELETE /api/produtos/:id"] },
    ],
  },
  {
    area: "movimentacoes",
    nome: "Movimentações (contadores)",
    acoes: [
      {
        chave: "movimentacoes.ver",
        nome: "Consultar movimentações e última leitura",
        rotas: [
          "GET /api/movimentacoes",
          "GET /api/movimentacoes/maquina/:maquinaId/ultima",
          "GET /api/movimentacoes/loja/:lojaId/maquina/:maquinaId/ultima",
          "GET /api/movimentacoes/:id",
        ],
      },
      {
        chave: "movimentacoes.historico",
        nome: "Ver tela Histórico de Movimentações",
        telas: ["/movimentacoes"],
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["movimentacoes.ver"],
      },
      {
        chave: "movimentacoes.registrar",
        nome: "Registrar movimentação",
        rotas: ["POST /api/movimentacoes"],
      },
      {
        chave: "movimentacoes.editar",
        nome: "Editar movimentação",
        rotas: ["PUT /api/movimentacoes/:id"],
        limites: [
          { chave: "dias", tipo: "dias", nome: "Só movimentações lançadas nos últimos N dias" },
        ],
      },
      {
        chave: "movimentacoes.editarDeOutros",
        nome: "Editar movimentação lançada por outra pessoa",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["movimentacoes.editar"],
      },
      {
        chave: "movimentacoes.corrigirContadores",
        nome: "Lançar contador menor que o anterior / abastecer acima do total (correção)",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
      },
      {
        chave: "movimentacoes.excluir",
        nome: "Excluir movimentação",
        rotas: ["DELETE /api/movimentacoes/:id"],
      },
      {
        chave: "movimentacoes.lerContadoresIa",
        nome: "Ler contadores por foto (IA)",
        rotas: ["POST /api/assistente-ia/ler-contadores"],
      },
    ],
  },
  {
    area: "alertas",
    nome: "Alertas",
    acoes: [
      {
        chave: "alertas.ver",
        nome: "Ver alertas (movimentação, estoque, extintor, contrato…)",
        rotas: [
          "GET /api/relatorios/alertas-movimentacao-out",
          "GET /api/relatorios/alertas-movimentacao-in",
          "GET /api/relatorios/alertas-bom-desempenho",
          "GET /api/relatorios/alertas-movimentacao-inconsistente",
          "GET /api/relatorios/alertas-estoque",
          "GET /api/relatorios/alertas-maquina-parada",
          "GET /api/relatorios/alertas-extintor",
          "GET /api/relatorios/alertas-contrato",
          "GET /api/relatorios/alertas-abastecimento-incompleto",
          "GET /api/alertas-movimentacao",
        ],
        telas: ["/alertas"],
      },
      {
        chave: "alertas.resolver",
        nome: "Resolver/descartar alertas",
        rotas: [
          "DELETE /api/relatorios/alertas-movimentacao-inconsistente/:id",
          "PATCH /api/alertas-movimentacao/:id/resolver",
        ],
        requer: ["alertas.ver"],
      },
      {
        chave: "alertas.registrar",
        nome: "Registrar alerta de movimentação",
        rotas: ["POST /api/alertas-movimentacao"],
      },
    ],
  },
  {
    area: "relatorios",
    nome: "Relatórios e Gráficos",
    acoes: [
      {
        chave: "relatorios.ver",
        nome: "Ver relatórios (balanço, desempenho, impressão, todas as lojas)",
        rotas: [
          "GET /api/relatorios/balanco-semanal",
          "GET /api/relatorios/performance-maquinas",
          "GET /api/relatorios/todas-lojas",
          "GET /api/relatorios/dashboard",
        ],
        telas: ["/relatorios"],
      },
      {
        chave: "relatorios.imprimir",
        nome: "Gerar relatório para impressão/exportar",
        rotas: ["GET /api/relatorios/impressao"],
        requer: ["relatorios.ver"],
      },
      {
        chave: "relatorios.fechamentoVer",
        nome: "Ver fechamentos mensais",
        rotas: [
          "GET /api/fechamentos-mensais-relatorio",
          "GET /api/fechamentos-mensais-relatorio/:id",
        ],
      },
      {
        chave: "relatorios.fechamentoGerar",
        nome: "Gerar fechamento mensal",
        rotas: ["POST /api/fechamentos-mensais-relatorio"],
        requer: ["relatorios.fechamentoVer"],
      },
      {
        chave: "graficos.ver",
        nome: "Ver gráficos (faturamento, ranking de lucro)",
        rotas: ["GET /api/graficos/dashboard", "GET /api/graficos/ranking-lucro-bruto-lojas"],
        telas: ["/graficos"],
      },
      {
        chave: "logs.ver",
        nome: "Ver log de atividades",
        rotas: ["GET /api/logs-atividade"],
      },
    ],
  },
  {
    area: "dinheiro",
    nome: "Dinheiro",
    acoes: [
      {
        chave: "dinheiro.registrar",
        nome: "Registrar contagem de dinheiro",
        rotas: ["POST /api/registro-dinheiro"],
      },
      {
        chave: "dinheiro.verValorEsperado",
        nome: "Ver valor esperado antes de contar",
        rotas: ["GET /api/registro-dinheiro/valor-esperado"],
      },
      {
        chave: "dinheiro.verUltimoFechamento",
        nome: "Ver último fechamento de dinheiro",
        rotas: ["GET /api/registro-dinheiro/ultimo-fechamento"],
      },
      {
        chave: "dinheiro.ver",
        nome: "Ver registros de dinheiro",
        rotas: ["GET /api/registro-dinheiro"],
        telas: ["/registrar-dinheiro"],
        limites: [
          LIMITE_DIAS,
          { chave: "somenteProprios", tipo: "sim", nome: "Só o que ele mesmo contou" },
        ],
      },
      {
        chave: "dinheiro.verAlertasBlink",
        nome: "Ver alertas Blink",
        rotas: [
          "GET /api/registro-dinheiro/alertas-blink",
          "GET /api/registro-dinheiro/alertas-fichas-blink",
        ],
      },
      {
        chave: "dinheiro.resolverAlertasBlink",
        nome: "Resolver alertas Blink",
        rotas: [
          "PATCH /api/registro-dinheiro/:id/resolver-alerta-blink",
          "PATCH /api/registro-dinheiro/:id/resolver-alerta-fichas-blink",
        ],
        requer: ["dinheiro.verAlertasBlink"],
      },
      {
        chave: "dinheiro.verTotais",
        nome: "Ver totais de dinheiro e Pix",
        rotas: ["GET /api/totais/dinheiro-pix"],
      },
      {
        chave: "sangrias.ver",
        nome: "Ver sangrias",
        rotas: ["GET /api/sangrias"],
        telas: ["/sangrias"],
        limites: [
          LIMITE_DIAS,
          { chave: "somenteProprias", tipo: "sim", nome: "Só as que ele mesmo registrou" },
        ],
      },
      { chave: "sangrias.registrar", nome: "Registrar sangria", rotas: ["POST /api/sangrias"] },
      {
        chave: "sangrias.historico",
        nome: "Ver histórico de sangrias na tela",
        capacidade: true,
        perfisPadrao: [],
        requer: ["sangrias.ver"],
      },
      {
        chave: "sangrias.definirDataHora",
        nome: "Escolher data/hora da sangria (senão vale a hora do registro)",
        capacidade: true,
        perfisPadrao: [],
        requer: ["sangrias.registrar"],
      },
      {
        chave: "sangrias.excluir",
        nome: "Excluir sangria",
        rotas: ["DELETE /api/sangrias/:id"],
        limites: [
          { chave: "somenteProprias", tipo: "sim", nome: "Só as que ele mesmo registrou" },
          { chave: "somenteMesmoDia", tipo: "sim", nome: "Só no mesmo dia em que foi registrada" },
        ],
      },
      {
        chave: "sangrias.excluirEmLote",
        nome: "Excluir sangrias em lote",
        rotas: ["DELETE /api/sangrias"],
        limites: [
          { chave: "somenteProprias", tipo: "sim", nome: "Só as que ele mesmo registrou" },
          { chave: "somenteMesmoDia", tipo: "sim", nome: "Só no mesmo dia em que foram registradas" },
        ],
      },
    ],
  },
  {
    area: "financeiro",
    nome: "Financeiro",
    acoes: [
      {
        chave: "contasPagar.ver",
        nome: "Ver contas a pagar",
        rotas: ["GET /api/contas-pagar"],
        telas: ["/contas-a-pagar"],
      },
      {
        chave: "contasPagar.criar",
        nome: "Lançar conta a pagar",
        rotas: ["POST /api/contas-pagar"],
        requer: ["contasPagar.ver"],
      },
      {
        chave: "contasPagar.editar",
        nome: "Editar conta a pagar",
        rotas: ["PUT /api/contas-pagar/:id"],
        requer: ["contasPagar.ver"],
      },
      {
        chave: "contasPagar.pagar",
        nome: "Dar baixa (pagar) conta",
        rotas: ["PATCH /api/contas-pagar/:id/pagar"],
        requer: ["contasPagar.ver"],
      },
      {
        chave: "contasPagar.excluir",
        nome: "Excluir conta a pagar",
        rotas: ["DELETE /api/contas-pagar/:id"],
      },
      {
        chave: "gastosVariaveis.ver",
        nome: "Ver gastos variáveis",
        rotas: ["GET /api/gastos-variaveis"],
        telas: ["/gastos-variaveis"],
      },
      {
        chave: "gastosVariaveis.criar",
        nome: "Lançar gasto variável",
        rotas: ["POST /api/gastos-variaveis"],
      },
      {
        chave: "gastosVariaveis.editar",
        nome: "Editar gasto variável",
        rotas: ["PUT /api/gastos-variaveis/:id"],
      },
      {
        chave: "gastosVariaveis.excluir",
        nome: "Excluir gasto variável",
        rotas: ["DELETE /api/gastos-variaveis/:id"],
      },
      {
        chave: "cotacao.ver",
        nome: "Ver cotação do dólar",
        rotas: ["GET /api/cotacoes-moeda"],
        telas: ["/configuracao-moeda"],
      },
      {
        chave: "cotacao.registrar",
        nome: "Registrar cotação do dólar",
        rotas: ["POST /api/cotacoes-moeda"],
        requer: ["cotacao.ver"],
      },
    ],
  },
  {
    area: "estoque",
    nome: "Estoque das lojas",
    acoes: [
      {
        chave: "estoque.ver",
        nome: "Consultar estoque das lojas",
        rotas: [
          "GET /api/estoque-lojas/:lojaId/alertas",
          "GET /api/estoque-lojas/:lojaId/analise",
          "GET /api/estoque-lojas/:lojaId",
          "GET /api/movimentacao-estoque-loja",
        ],
      },
      {
        chave: "estoque.tela",
        nome: "Ver tela de Estoque",
        telas: ["/estoque"],
        perfisPadrao: ["FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"],
        requer: ["estoque.ver"],
      },
      {
        chave: "estoque.analise",
        nome: "Ver tela de Análise de Estoque",
        telas: ["/analise-estoque"],
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["estoque.ver"],
      },
      {
        chave: "estoque.ajustar",
        nome: "Ajustar estoque da loja",
        rotas: [
          "POST /api/estoque-lojas/:lojaId/varios",
          "POST /api/estoque-lojas/:lojaId",
          "PUT /api/estoque-lojas/:lojaId/varios",
          "PUT /api/estoque-lojas/:lojaId/:produtoId",
        ],
      },
      {
        chave: "estoque.removerProduto",
        nome: "Remover produto do estoque da loja",
        rotas: ["DELETE /api/estoque-lojas/:lojaId/:produtoId"],
      },
      {
        chave: "estoque.movimentar",
        nome: "Registrar entrada/saída e transferências de estoque",
        rotas: [
          "POST /api/movimentacao-estoque-loja/transferir-do-deposito-principal",
          "POST /api/movimentacao-estoque-loja/transferir-da-garagem",
          "POST /api/movimentacao-estoque-loja",
        ],
      },
      {
        chave: "estoque.editarMovimentacao",
        nome: "Editar movimentação de estoque",
        rotas: ["PUT /api/movimentacao-estoque-loja/:id"],
      },
      {
        chave: "estoque.excluirMovimentacao",
        nome: "Excluir movimentação de estoque",
        rotas: ["DELETE /api/movimentacao-estoque-loja/:id"],
      },
    ],
  },
  {
    area: "envios",
    nome: "Envios e Transportadores",
    acoes: [
      { chave: "envios.ver", nome: "Ver envios", rotas: ["GET /api/envios"], telas: ["/envios"] },
      {
        chave: "envios.criar",
        nome: "Montar envio",
        rotas: ["POST /api/envios"],
        requer: ["envios.ver"],
      },
      {
        chave: "envios.despachar",
        nome: "Despachar envio",
        rotas: ["PATCH /api/envios/:id/despachar"],
        requer: ["envios.ver"],
      },
      {
        chave: "transportadores.ver",
        nome: "Ver transportadores",
        rotas: ["GET /api/transportadores"],
      },
      {
        chave: "transportadores.criar",
        nome: "Cadastrar transportador",
        rotas: ["POST /api/transportadores"],
      },
      {
        chave: "transportadores.editar",
        nome: "Editar transportador",
        rotas: ["PUT /api/transportadores/:id"],
      },
    ],
  },
  {
    area: "lacres",
    nome: "Lacres",
    acoes: [
      {
        chave: "lacres.conferir",
        nome: "Conferir lacres pendentes",
        rotas: ["GET /api/lacres/pendentes", "PATCH /api/lacres/:id/conferir"],
        telas: ["/conferencia-lacre"],
      },
      {
        chave: "lacres.verDivergentes",
        nome: "Ver lacres divergentes",
        rotas: ["GET /api/lacres/divergentes"],
      },
      {
        chave: "lacres.resolver",
        nome: "Resolver/reabrir divergência de lacre",
        rotas: ["PATCH /api/lacres/:id/resolver", "PATCH /api/lacres/:id/reabrir"],
        requer: ["lacres.verDivergentes"],
      },
      {
        chave: "lacres.alertasEmTransito",
        nome: "Ver alertas de lacre em trânsito",
        rotas: ["GET /api/lacres/alertas/em-transito"],
      },
    ],
  },
  {
    area: "compras",
    nome: "Compras e Fornecedores",
    acoes: [
      {
        chave: "compras.ver",
        nome: "Ver compras e histórico de preços",
        rotas: ["GET /api/compras", "GET /api/compras/historico-precos"],
        telas: ["/compras"],
      },
      {
        chave: "compras.criar",
        nome: "Lançar compra",
        rotas: ["POST /api/compras"],
        requer: ["compras.ver"],
      },
      {
        chave: "compras.editar",
        nome: "Editar compra",
        rotas: ["PUT /api/compras/:id"],
        requer: ["compras.ver"],
      },
      {
        chave: "compras.mudarStatus",
        nome: "Mudar status da compra",
        rotas: ["PATCH /api/compras/:id/status"],
        requer: ["compras.ver"],
      },
      {
        chave: "compras.conferir",
        nome: "Conferir recebimento da compra",
        rotas: ["PATCH /api/compras/:id/conferencia"],
        requer: ["compras.ver"],
      },
      {
        chave: "compras.desfazerRecebimento",
        nome: "Desfazer recebimento da compra",
        rotas: ["PATCH /api/compras/:id/desfazer-recebimento"],
        requer: ["compras.ver"],
      },
      { chave: "compras.excluir", nome: "Excluir compra", rotas: ["DELETE /api/compras/:id"] },
      {
        chave: "compras.gerarContasPagar",
        nome: "Gerar contas a pagar da compra",
        rotas: ["POST /api/compras/:id/contas-pagar"],
        requer: ["compras.ver"],
      },
      {
        chave: "compras.verValores",
        nome: "Ver valores (R$) de compras e insumos",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO", "FUNCIONARIO_CADASTRO"],
      },
      {
        chave: "compras.gerarCusto",
        nome: "Dar compra como comprada e gerar contas a pagar (gera custo)",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO", "FUNCIONARIO_CADASTRO"],
      },
      {
        chave: "compras.aceitarSugestao",
        nome: "Aceitar sugestão de compra ao lançar a compra",
        capacidade: true,
        perfisPadrao: [],
      },
      {
        chave: "sugestoesCompra.ver",
        nome: "Ver sugestões de compra",
        rotas: ["GET /api/sugestoes-compra"],
      },
      {
        chave: "sugestoesCompra.criar",
        nome: "Sugerir compra",
        rotas: ["POST /api/sugestoes-compra"],
      },
      {
        chave: "sugestoesCompra.recusar",
        nome: "Recusar sugestão de compra",
        rotas: ["PATCH /api/sugestoes-compra/:id/recusar"],
        requer: ["sugestoesCompra.ver"],
      },
      {
        chave: "fornecedores.ver",
        nome: "Ver fornecedores e comparações",
        rotas: ["GET /api/fornecedores", "GET /api/fornecedores/comparacoes"],
      },
      {
        chave: "fornecedores.criar",
        nome: "Cadastrar fornecedor",
        rotas: ["POST /api/fornecedores"],
      },
      {
        chave: "fornecedores.editar",
        nome: "Editar fornecedor",
        rotas: ["PUT /api/fornecedores/:id"],
      },
      {
        chave: "fornecedores.excluir",
        nome: "Excluir fornecedor",
        rotas: ["DELETE /api/fornecedores/:id"],
      },
    ],
  },
  {
    area: "fabricacao",
    nome: "Fabricação de Pelúcia",
    acoes: [
      {
        chave: "fabricacao.tela",
        nome: "Ver tela de Fabricação de Pelúcia",
        telas: ["/fabricacao-pelucia"],
        perfisPadrao: ["FUNCIONARIO_ESTOQUE", "FUNCIONARIO_CADASTRO"],
        requer: ["insumos.ver", "receitas.ver", "pedidosPelucia.ver"],
      },
      {
        chave: "insumos.ver",
        nome: "Ver insumos e compras de insumo",
        rotas: ["GET /api/insumos", "GET /api/insumos/compras"],
      },
      { chave: "insumos.criar", nome: "Cadastrar insumo", rotas: ["POST /api/insumos"] },
      { chave: "insumos.editar", nome: "Editar insumo", rotas: ["PUT /api/insumos/:id"] },
      { chave: "insumos.excluir", nome: "Excluir insumo", rotas: ["DELETE /api/insumos/:id"] },
      {
        chave: "insumos.registrarCompra",
        nome: "Registrar compra de insumo",
        rotas: ["POST /api/insumos/:id/compras"],
      },
      { chave: "receitas.ver", nome: "Ver receitas", rotas: ["GET /api/receitas"] },
      {
        chave: "receitas.editar",
        nome: "Editar receita do produto",
        rotas: ["PUT /api/receitas/produto/:produtoId"],
      },
      {
        chave: "pedidosPelucia.ver",
        nome: "Ver pedidos de pelúcia",
        rotas: ["GET /api/pedidos-pelucia"],
      },
      {
        chave: "pedidosPelucia.criar",
        nome: "Criar pedido de pelúcia",
        rotas: ["POST /api/pedidos-pelucia"],
      },
      {
        chave: "pedidosPelucia.baixa",
        nome: "Dar baixa em pedido de pelúcia",
        rotas: ["PATCH /api/pedidos-pelucia/:id/baixa"],
      },
    ],
  },
  {
    area: "pecas",
    nome: "Peças",
    acoes: [
      {
        chave: "pecas.ver",
        nome: "Consultar peças e estoque de peças do funcionário",
        rotas: ["GET /api/pecas", "GET /api/pecas/estoque-funcionario"],
      },
      {
        chave: "pecas.tela",
        nome: "Ver tela de Peças",
        telas: ["/pecas"],
        perfisPadrao: ["FUNCIONARIO", "FUNCIONARIO_CADASTRO"],
        requer: ["pecas.ver"],
      },
      { chave: "pecas.verEnvios", nome: "Ver envios de peças", rotas: ["GET /api/pecas/envios"] },
      { chave: "pecas.criar", nome: "Cadastrar peça", rotas: ["POST /api/pecas"] },
      { chave: "pecas.editar", nome: "Editar peça", rotas: ["PUT /api/pecas/:id"] },
      { chave: "pecas.excluir", nome: "Excluir peça", rotas: ["DELETE /api/pecas/:id"] },
      {
        chave: "pecas.lancarQuantidade",
        nome: "Lançar quantidade de peça",
        rotas: ["POST /api/pecas/:id/lancar-quantidade"],
      },
      {
        chave: "pecas.enviar",
        nome: "Enviar peça para funcionário",
        rotas: ["POST /api/pecas/:id/enviar"],
      },
      {
        chave: "pecas.devolver",
        nome: "Devolver peça",
        rotas: ["POST /api/pecas/:id/devolver"],
      },
    ],
  },
  {
    area: "manutencao",
    nome: "Manutenção",
    acoes: [
      {
        chave: "manutencao.ver",
        nome: "Ver manutenções",
        rotas: [
          "GET /api/manutencoes",
          "GET /api/manutencoes/maquina/:maquinaId",
          "GET /api/manutencoes/:id/pecas",
          "GET /api/manutencoes/:id/pecas-quebradas",
        ],
        telas: ["/manutencao"],
      },
      {
        chave: "manutencao.criar",
        nome: "Abrir manutenção",
        rotas: ["POST /api/manutencoes"],
        requer: ["manutencao.ver", "manutencao.listarFuncionarios"],
      },
      {
        chave: "manutencao.listarFuncionarios",
        nome: "Ver lista de funcionários para atribuir manutenção",
        rotas: ["GET /api/manutencoes/funcionarios"],
      },
      {
        chave: "manutencao.mudarStatus",
        nome: "Mudar status da manutenção (andamento, concluir)",
        rotas: ["PATCH /api/manutencoes/:id/status"],
        requer: ["manutencao.ver"],
      },
      {
        chave: "manutencao.registrarPeca",
        nome: "Registrar peça usada na manutenção",
        rotas: ["POST /api/manutencoes/:id/pecas"],
        requer: ["manutencao.ver"],
      },
      {
        chave: "manutencao.registrarPecaQuebrada",
        nome: "Registrar peça quebrada na manutenção",
        rotas: ["POST /api/manutencoes/:id/pecas-quebradas"],
        requer: ["manutencao.ver"],
      },
      {
        chave: "manutencao.gerenciarTodas",
        nome: "Ver e mexer em todas as manutenções (não só as atribuídas a ele)",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["manutencao.ver"],
      },
      {
        chave: "manutencao.registrarPorOutro",
        nome: "Registrar peça usada/devolvida em nome de outro funcionário",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
      },
      {
        chave: "manutencao.lancarCusto",
        nome: "Informar custo na manutenção (gera gasto)",
        capacidade: true,
        perfisPadrao: [],
      },
      {
        chave: "manutencao.verAlertas",
        nome: "Ver alertas de manutenção (atrasadas, recorrentes)",
        rotas: [
          "GET /api/manutencoes/alertas/atrasadas",
          "GET /api/manutencoes/alertas/recorrentes",
        ],
      },
    ],
  },
  {
    area: "roteiros",
    nome: "Roteiros",
    acoes: [
      {
        chave: "roteiros.ver",
        nome: "Ver roteiros",
        rotas: ["GET /api/roteiros"],
        telas: ["/roteiros"],
        // A tela de roteiros também carrega lojas, máquinas e veículos
        requer: ["lojas.ver", "maquinas.ver", "veiculos.ver"],
      },
      {
        chave: "roteiros.executar",
        nome: "Executar roteiro (concluir itens e máquinas)",
        rotas: [
          "PATCH /api/roteiros/itens/:id/concluir",
          "PATCH /api/roteiros/itens/:id/maquinas/:maquinaId/concluir",
        ],
        telas: ["/roteiros/:id/executar"],
        requer: ["roteiros.ver"],
      },
      {
        chave: "roteiros.verTodos",
        nome: "Ver e executar roteiros de outros funcionários",
        capacidade: true,
        perfisPadrao: ["FUNCIONARIO_CADASTRO"],
        requer: ["roteiros.ver"],
      },
      { chave: "roteiros.criar", nome: "Criar roteiro", rotas: ["POST /api/roteiros"] },
      { chave: "roteiros.editar", nome: "Editar roteiro", rotas: ["PUT /api/roteiros/:id"] },
      { chave: "roteiros.excluir", nome: "Excluir roteiro", rotas: ["DELETE /api/roteiros/:id"] },
      {
        chave: "roteiros.editarItens",
        nome: "Adicionar/editar/remover itens do roteiro",
        rotas: [
          "POST /api/roteiros/:roteiroId/itens",
          "PUT /api/roteiros/itens/:id",
          "DELETE /api/roteiros/itens/:id",
        ],
      },
    ],
  },
  {
    area: "veiculos",
    nome: "Veículos",
    acoes: [
      {
        chave: "veiculos.ver",
        nome: "Consultar veículos, alertas e uso",
        rotas: [
          "GET /api/veiculos",
          "GET /api/alertas-veiculos",
          "GET /api/movimentacao-veiculos/ultimas",
          "GET /api/movimentacao-veiculos",
        ],
      },
      {
        chave: "veiculos.tela",
        nome: "Ver tela de Veículos",
        telas: ["/veiculos"],
        perfisPadrao: ["FUNCIONARIO", "FUNCIONARIO_CADASTRO"],
        requer: ["veiculos.ver"],
      },
      {
        chave: "veiculos.registrarUso",
        nome: "Registrar retirada/devolução/abastecimento",
        rotas: ["POST /api/movimentacao-veiculos"],
      },
      { chave: "veiculos.criar", nome: "Cadastrar veículo", rotas: ["POST /api/veiculos"] },
      { chave: "veiculos.editar", nome: "Editar veículo", rotas: ["PUT /api/veiculos/:id"] },
      { chave: "veiculos.excluir", nome: "Excluir veículo", rotas: ["DELETE /api/veiculos/:id"] },
    ],
  },
  {
    area: "treinamentos",
    nome: "Treinamentos",
    acoes: [
      {
        chave: "treinamentos.ver",
        nome: "Assistir treinamentos",
        rotas: ["GET /api/treinamentos/videos"],
        telas: ["/treinamentos"],
      },
      {
        chave: "treinamentos.enviarFeedback",
        nome: "Enviar feedback de treinamento",
        rotas: ["POST /api/treinamentos/feedbacks"],
      },
      {
        chave: "treinamentos.criarVideo",
        nome: "Cadastrar vídeo de treinamento",
        rotas: ["POST /api/treinamentos/videos"],
      },
      {
        chave: "treinamentos.editarVideo",
        nome: "Editar vídeo de treinamento",
        rotas: ["PUT /api/treinamentos/videos/:id"],
      },
      {
        chave: "treinamentos.excluirVideo",
        nome: "Excluir vídeo de treinamento",
        rotas: ["DELETE /api/treinamentos/videos/:id"],
      },
      {
        chave: "treinamentos.verFeedbacks",
        nome: "Ver feedbacks de treinamento",
        rotas: [
          "GET /api/treinamentos/feedbacks",
          "PATCH /api/treinamentos/feedbacks/:id/visualizado",
        ],
      },
    ],
  },
  {
    area: "sistema",
    nome: "Sistema",
    acoes: [
      {
        chave: "assistenteIa.comando",
        nome: "Usar o assistente IA Mico",
        rotas: ["POST /api/assistente-ia/comando"],
      },
      {
        chave: "desenvolvimento.ver",
        nome: "Ver sugestões de desenvolvimento",
        rotas: ["GET /api/desenvolvimento"],
        telas: ["/desenvolvimento"],
      },
      {
        chave: "desenvolvimento.criar",
        nome: "Enviar sugestão de desenvolvimento",
        rotas: ["POST /api/desenvolvimento"],
      },
      {
        chave: "desenvolvimento.gerenciar",
        nome: "Responder, revisar, mover e baixar sugestões",
        rotas: [
          "PATCH /api/desenvolvimento/:id/responder",
          "PATCH /api/desenvolvimento/:id/revisao",
          "PATCH /api/desenvolvimento/:id/mover",
          "PATCH /api/desenvolvimento/:id/baixar",
        ],
      },
      {
        chave: "modoSeguranca.ativar",
        nome: "Ativar o modo segurança",
        rotas: ["POST /api/modo-seguranca/ativar"],
      },
      {
        chave: "sistema.limpezaDados",
        nome: "Limpar dados antigos",
        rotas: ["GET /api/admin/verificar-limpeza", "POST /api/admin/limpar-dados-antigos"],
        somenteAdmin: true,
      },
    ],
  },
  {
    area: "usuarios",
    nome: "Usuários",
    acoes: [
      {
        chave: "usuarios.ver",
        nome: "Consultar usuários",
        rotas: ["GET /api/usuarios", "GET /api/usuarios/:id"],
      },
      {
        chave: "usuarios.gerenciar",
        nome: "Cadastrar, editar, desativar usuários e mudar acessos",
        rotas: [
          "POST /api/usuarios",
          "PUT /api/usuarios/:id",
          "DELETE /api/usuarios/:id",
          "PATCH /api/usuarios/:id/reativar",
          "PUT /api/usuarios/:id/acessos",
          "GET /api/permissoes/catalogo",
        ],
        telas: ["/usuarios", "/usuarios/novo", "/usuarios/:id/editar"],
        somenteAdmin: true,
      },
    ],
  },
];

export const ACOES = CATALOGO.flatMap((area) =>
  area.acoes.map((acao) => ({ ...acao, area: area.area })),
);

export const ACOES_POR_CHAVE = new Map(ACOES.map((acao) => [acao.chave, acao]));
