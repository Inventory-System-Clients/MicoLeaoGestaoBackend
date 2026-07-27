# Prompt para Frontend - Área de Suporte Técnico (nova aba, separada do sistema atual)

## 🗣️ Pedido original (contexto para quem for implementar)

> Criar uma área de suporte técnico da Agarra Mais: uma aba nova no dashboard principal (botão ao lado de "Veículos") que leva para uma área totalmente separada do restante do sistema — como se fosse um "site novo" dentro do app. Cada login deve ter acessos diferentes: ADMIN consegue criar produtos e peças e dar entradas/saídas; usuário comum (FUNCIONARIO) só consegue dar entrada/saída. Em toda entrada/saída deve dar pra escrever o motivo, para manter o controle da quantidade de cada peça em estoque. O ADMIN também deve conseguir ver o histórico de entradas e saídas: por quem, quando e por quê. Precisa ser bem fácil e prático dar entrada/saída no dia a dia.

O backend para isso **já está pronto** (endpoints abaixo). Este documento é o que falta: implementar a tela no frontend, de forma coerente com o que o backend espera/retorna.

## 🎯 Objetivo

Criar uma **área nova e isolada** dentro do frontend: "Suporte Técnico". É um controle de estoque de peças/produtos usados pela equipe técnica (entradas e saídas), com histórico de quem mexeu, quando e por quê.

**Importante**: não alterar nada do que já existe (Veículos, Lojas, Máquinas, Estoque de Lojas, Produtos, etc). Esta é uma tela nova, com rotas e componentes próprios, sem reaproveitar as telas de estoque de lojas já existentes (são domínios diferentes: um é estoque de pelúcias por loja, o outro é peças/produtos de suporte técnico).

## 📍 Onde entra no Dashboard

No Dashboard principal, adicionar um botão/card **"Suporte Técnico"** ao lado do botão/card já existente de **"Veículos"** (mesmo componente/estilo de navegação usado para os outros atalhos do dashboard, só muda ícone, texto e destino).

Ao clicar, navega para uma rota nova e independente, por exemplo `/suporte-tecnico`. Como o pedido é que pareça "uma aba totalmente diferente da Agarra Mais", essa rota deve ter **layout próprio** (header/topo diferente, pode ter cor de destaque própria) em vez de herdar o layout do dashboard principal — dando a sensação de entrar em outra área/mini-app, mesmo estando dentro do mesmo projeto React (reaproveita login/token, mas visualmente se destaca). Incluir um jeito claro de voltar ao dashboard principal (ex: botão "← Voltar ao Dashboard" no topo).

Visível para **ADMIN e FUNCIONARIO** (todo usuário autenticado vê o botão).

## 🔐 Permissões (usuario.role)

| Ação | ADMIN | FUNCIONARIO |
|---|---|---|
| Ver lista de itens (peças/produtos) e quantidade em estoque | ✅ | ✅ |
| Dar entrada/saída em um item (com motivo) | ✅ | ✅ |
| Criar novo item (peça ou produto) | ✅ | ❌ |
| Editar item (nome, tipo, código, descrição, estoque mínimo) | ✅ | ❌ |
| Desativar/remover item | ✅ | ❌ |
| Ver histórico completo de movimentações (quem, quando, por quê) | ✅ | ❌ |

## 📡 Backend - Endpoints disponíveis

Base: `/api/suporte-tecnico` (mesma base de autenticação/token do resto do sistema — enviar `Authorization: Bearer <token>`).

### 1. Listar itens (peças/produtos)

```
GET /api/suporte-tecnico/itens
GET /api/suporte-tecnico/itens?tipo=PECA        (ou PRODUTO)
GET /api/suporte-tecnico/itens?busca=parafuso   (filtra por nome ou código)
```

Acesso: ADMIN e FUNCIONARIO.

**Response:**

```json
[
  {
    "id": "uuid",
    "nome": "Motor de Garra",
    "tipo": "PECA",
    "codigo": "MOT-001",
    "descricao": "Motor usado nas garras das máquinas",
    "quantidade": 12,
    "estoqueMinimo": 3,
    "ativo": true,
    "criadoPorId": "uuid",
    "createdAt": "2026-07-14T10:00:00Z",
    "updatedAt": "2026-07-14T10:00:00Z"
  }
]
```

### 2. Criar item — **ADMIN apenas**

```
POST /api/suporte-tecnico/itens
```

**Body:**

```json
{
  "nome": "Motor de Garra",
  "tipo": "PECA",
  "codigo": "MOT-001",
  "descricao": "Motor usado nas garras das máquinas",
  "estoqueMinimo": 3,
  "quantidade": 0
}
```

`tipo` deve ser `"PECA"` ou `"PRODUTO"`. `codigo`, `descricao`, `estoqueMinimo` e `quantidade` (estoque inicial) são opcionais.

### 3. Editar item — **ADMIN apenas**

```
PUT /api/suporte-tecnico/itens/:id
```

Body com os campos que quiser atualizar: `nome`, `tipo`, `codigo`, `descricao`, `estoqueMinimo`.

**Não dá para editar `quantidade` diretamente aqui** — a quantidade só muda por entrada/saída (endpoint de movimentação), para manter o histórico sempre batendo com o saldo.

### 4. Desativar item — **ADMIN apenas**

```
DELETE /api/suporte-tecnico/itens/:id
```

Desativa (soft delete) — some da listagem, mas o histórico de movimentações dele continua acessível.

### 5. Registrar entrada ou saída — **ADMIN e FUNCIONARIO**

```
POST /api/suporte-tecnico/movimentacoes
```

**Body:**

```json
{
  "itemId": "uuid",
  "tipo": "SAIDA",
  "quantidade": 2,
  "motivo": "Troca do motor da garra na máquina 12 da Loja Shopping"
}
```

`tipo` é `"ENTRADA"` ou `"SAIDA"`. `motivo` é **obrigatório** (é o "porquê"). Em `SAIDA`, o backend valida que tem quantidade suficiente em estoque e retorna erro 400 se não tiver. O backend já atualiza a quantidade do item automaticamente.

**Response (201):** a movimentação criada, já com `item` e `usuario` inclusos (quem fez).

### 6. Histórico de movimentações — **ADMIN apenas**

```
GET /api/suporte-tecnico/movimentacoes
GET /api/suporte-tecnico/movimentacoes?itemId=uuid
GET /api/suporte-tecnico/movimentacoes?tipo=SAIDA
GET /api/suporte-tecnico/movimentacoes?usuarioId=uuid
GET /api/suporte-tecnico/movimentacoes?dataInicio=2026-07-01&dataFim=2026-07-14
```

**Response:**

```json
[
  {
    "id": "uuid",
    "itemId": "uuid",
    "tipo": "SAIDA",
    "quantidade": 2,
    "motivo": "Troca do motor da garra na máquina 12 da Loja Shopping",
    "quantidadeAnterior": 12,
    "quantidadeAtual": 10,
    "usuarioId": "uuid",
    "createdAt": "2026-07-14T15:30:00Z",
    "item": { "id": "uuid", "nome": "Motor de Garra", "codigo": "MOT-001", "tipo": "PECA" },
    "usuario": { "id": "uuid", "nome": "João", "email": "joao@...", "role": "FUNCIONARIO" }
  }
]
```

Isso já dá tudo para a tabela de histórico: **quem** (`usuario.nome`), **quando** (`createdAt`), **o quê** (`item.nome`, `tipo`, `quantidade`) e **por quê** (`motivo`).

## 💻 Exemplo de chamadas (usando o `api.js` já existente no projeto)

O projeto já tem um client axios (`api.js`) que injeta o token automaticamente e trata 401 — use ele, não `fetch` cru:

```javascript
import api from "../api";

// Listar itens
const { data: itens } = await api.get("/suporte-tecnico/itens");

// Buscar por nome/código
const { data: itens } = await api.get("/suporte-tecnico/itens", {
  params: { busca: termo },
});

// Dar entrada ou saída
try {
  await api.post("/suporte-tecnico/movimentacoes", {
    itemId,
    tipo: "SAIDA", // ou "ENTRADA"
    quantidade: 2,
    motivo,
  });
} catch (error) {
  // error.response?.data?.error já vem com a mensagem pronta do backend
  // ex: "Quantidade insuficiente em estoque. Disponível: 5"
  alert(error.response?.data?.error || "Erro ao registrar movimentação");
}

// (ADMIN) Criar item
await api.post("/suporte-tecnico/itens", {
  nome,
  tipo, // "PECA" ou "PRODUTO"
  codigo,
  descricao,
  estoqueMinimo,
  quantidade: 0,
});

// (ADMIN) Histórico com filtros
const { data: movimentacoes } = await api.get("/suporte-tecnico/movimentacoes", {
  params: { itemId, tipo, usuarioId, dataInicio, dataFim },
});
```

Controle de visibilidade por role (mesmo padrão já usado no resto do dashboard):

```javascript
const isAdmin = usuario?.role === "ADMIN";
```

## 🎨 Telas sugeridas

### Tela principal `/suporte-tecnico` (ADMIN e FUNCIONARIO)

O foco é ser **rápido e prático** para dar entrada/saída, então:

- Lista/grid de itens com busca rápida (nome ou código), mostrando: emoji genérico (🔧 peça / 📦 produto), nome, código, tipo, **quantidade atual em destaque**.
- Em cada item, dois botões diretos: **"+ Entrada"** e **"− Saída"**.
- Ao clicar em um deles, abre um modal simples:
  - Quantidade (input numérico, obrigatório, > 0)
  - Motivo (textarea, obrigatório) — ex: "Reposição de estoque", "Usado na manutenção da máquina X"
  - Botão confirmar → `POST /movimentacoes`
- Se `tipo=SAIDA` e a API retornar erro de estoque insuficiente, mostrar a mensagem de erro do backend (já vem pronta, ex: "Quantidade insuficiente em estoque. Disponível: 5").
- Destacar visualmente (ex: badge amarelo/vermelho neutro, sem exagero) itens com `quantidade <= estoqueMinimo`.

### Gestão de itens — **ADMIN apenas**

- Botão "Novo Item" no topo da tela principal (só aparece para ADMIN) → formulário com nome, tipo (peça/produto), código, descrição, estoque mínimo, estoque inicial.
- Cada item (visível só para ADMIN) tem opções de "Editar" e "Desativar".

### Histórico — **ADMIN apenas**

- Nova aba/seção dentro da área de Suporte Técnico: "Histórico de Movimentações".
- Tabela com colunas: Data/Hora, Item, Tipo (Entrada/Saída), Quantidade, Motivo, Usuário.
- Filtros: por item, por tipo, por usuário, por período (data início/fim).
- Ordenado do mais recente para o mais antigo (já vem assim da API).

## ⚠️ O que NÃO fazer

1. Não reaproveitar os componentes de "Estoque de Lojas" — é uma área e um domínio de dados diferentes.
2. Não permitir que FUNCIONARIO veja o histórico completo nem crie/edite/desative itens (esconder esses elementos de UI, e o backend também bloqueia com 403).
3. Não permitir editar `quantidade` de um item diretamente num form de edição — sempre passar pelo fluxo de entrada/saída.

## ✅ Checklist

- [ ] Botão "Suporte Técnico" no Dashboard, ao lado de "Veículos", visível para ADMIN e FUNCIONARIO
- [ ] Rota nova `/suporte-tecnico` com layout próprio (área separada do resto do sistema)
- [ ] Listagem de itens com busca, quantidade em destaque e indicação de estoque baixo
- [ ] Fluxo rápido de Entrada/Saída (modal com quantidade + motivo obrigatório)
- [ ] Tratamento do erro de estoque insuficiente numa saída
- [ ] (ADMIN) Criar/editar/desativar itens
- [ ] (ADMIN) Tela de histórico com filtros (item, tipo, usuário, período)
- [ ] Esconder ações de ADMIN para usuários FUNCIONARIO
