Copie todo o conteúdo abaixo e envie para o agente de programação que terá acesso ao outro projeto.

---

Você é um engenheiro de software sênior trabalhando diretamente neste repositório. Implemente, de ponta a ponta, uma funcionalidade de leitura de contadores numéricos por foto para o módulo de movimentações.

O objetivo é reproduzir o seguinte comportamento:

1. No formulário de criação ou edição de uma movimentação, o usuário pode tirar ou selecionar uma foto que contenha dois contadores mecânicos numéricos.
2. O frontend converte a imagem para Base64 e envia a foto para um endpoint autenticado do backend.
3. O backend valida a imagem e a envia para um modelo da OpenAI com capacidade de visão.
4. A IA lê exclusivamente os números dos dois contadores mecânicos.
5. Pela regra deste negócio, o maior número lido deve ser classificado como `contadorIn` e o menor como `contadorOut`.
6. O backend retorna JSON estruturado com `contadorIn`, `contadorOut`, `confianca` e `observacao`.
7. O frontend preenche automaticamente os campos “Contador de entrada (IN)” e “Contador de saída (OUT)” do formulário.
8. O usuário continua podendo revisar e alterar manualmente os valores antes de salvar.
9. Ao salvar a movimentação, os valores de `contadorIn` e `contadorOut` são persistidos normalmente junto aos demais dados.

Não entregue somente uma explicação ou pseudocódigo. Inspecione o projeto, implemente a funcionalidade nos arquivos corretos, execute as verificações disponíveis e apresente um resumo dos arquivos alterados.

## 1. Antes de alterar o projeto

Primeiro, inspecione a arquitetura existente e identifique:

- linguagem e framework do backend;
- linguagem e framework do frontend;
- cliente HTTP utilizado pelo frontend;
- padrão de autenticação e onde o token é adicionado às requisições;
- modelo, migration, controller, service e rotas de movimentações;
- formulário usado para criar e editar movimentações;
- nomes atuais dos campos equivalentes a contador de entrada e contador de saída;
- padrão existente para variáveis de ambiente;
- versão do Node.js e disponibilidade de `fetch`;
- limite atual do parser JSON;
- padrão de testes, lint, build e tratamento de erros.

Adapte a implementação à arquitetura encontrada. Não crie uma segunda camada de API, outro cliente HTTP ou componentes duplicados se o projeto já possuir equivalentes.

Se os campos de contadores tiverem nomes diferentes, preserve internamente os nomes existentes, mas mantenha um mapeamento explícito e consistente no contrato da leitura da imagem.

## 2. Contrato funcional obrigatório

Crie um endpoint equivalente a:

```http
POST /api/assistente-ia/ler-contadores
Authorization: Bearer <token>
Content-Type: application/json
```

Corpo:

```json
{
  "imagemBase64": "<conteudo-base64-sem-ou-com-prefixo-data-url>",
  "mimeType": "image/jpeg"
}
```

O backend deve aceitar `imagemBase64` tanto puro quanto no formato:

```text
data:image/jpeg;base64,/9j/4AAQSk...
```

Resposta de sucesso:

```json
{
  "contadorIn": 123456,
  "contadorOut": 98765,
  "confianca": "alta",
  "observacao": "Os dois contadores estão visíveis."
}
```

Quando a leitura não for segura:

```json
{
  "contadorIn": null,
  "contadorOut": null,
  "confianca": "baixa",
  "observacao": "Não foi possível ler os dois contadores com segurança."
}
```

Valores permitidos para `confianca`:

```text
alta
media
baixa
```

O endpoint deve exigir autenticação, usando o middleware já existente no projeto. A chave da OpenAI jamais pode ir para o frontend.

## 3. Banco de dados e movimentações

Garanta que a entidade/tabela de movimentações tenha os campos:

```text
contador_in  INTEGER NULL
contador_out INTEGER NULL
```

Na camada de aplicação, prefira:

```text
contadorIn
contadorOut
```

Se ainda não existirem, crie uma migration idempotente ou equivalente ao padrão do projeto. Em PostgreSQL, a alteração esperada é conceitualmente:

```sql
ALTER TABLE movimentacoes
ADD COLUMN IF NOT EXISTS contador_in INTEGER;

ALTER TABLE movimentacoes
ADD COLUMN IF NOT EXISTS contador_out INTEGER;
```

Atualize:

- modelo/entidade da movimentação;
- criação da movimentação;
- atualização da movimentação;
- serialização e consulta da movimentação;
- tipos/interfaces/DTOs do backend e do frontend;
- valores iniciais e reset do formulário.

Os campos devem ser inteiros, não negativos e anuláveis. Não transforme uma falha de leitura em zero. Ausência de leitura deve continuar sendo `null` ou campo vazio.

Ao criar uma movimentação, o payload deve incluir:

```json
{
  "contadorIn": 123456,
  "contadorOut": 98765
}
```

Se o sistema já compara contadores com a movimentação anterior, preserve a regra existente. Caso seja necessário implementar a mesma regra do sistema de referência:

- para usuários comuns, um contador positivo não pode ser menor que o contador correspondente da última movimentação da mesma máquina;
- administradores podem corrigir valores retroativos;
- valores ausentes ou iguais a zero não devem acionar essa comparação, caso essa seja a convenção já usada pelo projeto;
- a API deve responder com erro `400` e uma mensagem clara indicando se o problema está no IN ou no OUT.

Não salve automaticamente a movimentação após a leitura da imagem. A IA apenas preenche o formulário; o usuário confirma pelo fluxo normal de salvamento.

## 4. Variáveis de ambiente

Adicione ao arquivo de exemplo de ambiente:

```env
OPENAI_API_KEY=sua_openai_api_key_aqui
OPENAI_MODEL=gpt-4.1-mini
```

No backend, use:

```javascript
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MODELO_PADRAO = process.env.OPENAI_MODEL || "gpt-4.1-mini";
```

Não fixe a chave no código, não registre a chave em logs e não exponha detalhes sensíveis da requisição ao frontend.

O modelo deve ser configurável porque o nome disponível pode variar entre ambientes. Se o projeto já usa um SDK ou uma abstração oficial da OpenAI, integre-se ao padrão existente sem alterar o contrato funcional descrito aqui.

## 5. Schema estruturado da resposta da IA

Use saída estruturada com JSON Schema estrito. O schema deve ser semanticamente igual a:

```javascript
const schemaLeituraContadores = {
  type: "object",
  additionalProperties: false,
  required: ["contadorIn", "contadorOut", "confianca", "observacao"],
  properties: {
    contadorIn: { type: ["integer", "null"] },
    contadorOut: { type: ["integer", "null"] },
    confianca: {
      type: "string",
      enum: ["alta", "media", "baixa"],
    },
    observacao: { type: "string" },
  },
};
```

Não tente extrair números de texto livre com regex se a API puder retornar o JSON validado pelo schema.

Implemente também uma função robusta para obter o texto da Responses API. Ela deve aceitar:

- `payload.output_text`, quando disponível;
- os itens de `payload.output[*].content[*]` cujo tipo seja `output_text`.

Se nenhum texto estruturado for retornado, trate como erro de integração com status `502`.

## 6. Instruções exatas para a visão

Envie a imagem como Data URL:

```javascript
const dataUrl = `data:${mimeType};base64,${imagemBase64}`;
```

Use instruções equivalentes a estas, preservando as regras de negócio:

```text
Você lê fotos de dois contadores mecânicos numéricos de máquina.
Retorne apenas JSON conforme o schema.
Leia somente os números brancos dentro das janelas pretas dos contadores mecânicos.
Ignore voltímetro, régua, parafusos, cabos, madeira, etiquetas e qualquer outro número fora dos contadores.
Normalmente existem dois contadores.
O maior número sempre é contadorIn.
O menor número sempre é contadorOut.
Se não conseguir ler os dois com segurança, retorne contadorIn null, contadorOut null e confiança baixa.
Não chute. Prefira null se estiver em dúvida.
```

O conteúdo enviado pelo usuário deve conter:

```text
Leia os dois contadores mecânicos da foto. O maior número é IN e o menor é OUT.
```

Monte uma requisição equivalente a:

```javascript
{
  model: MODELO_PADRAO,
  instructions: instrucoes,
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Leia os dois contadores mecânicos da foto. O maior número é IN e o menor é OUT."
        },
        {
          type: "input_image",
          image_url: dataUrl
        }
      ]
    }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "leitura_contadores",
      strict: true,
      schema: schemaLeituraContadores
    }
  },
  max_output_tokens: 300
}
```

Importante: “maior = IN e menor = OUT” é uma regra específica deste negócio. Não substitua essa regra por posição visual, legenda presumida, ordem esquerda/direita ou ordem superior/inferior.

## 7. Validação da imagem no backend

No controller do endpoint:

1. Obtenha `imagemBase64` do corpo.
2. Remova, se existir, o prefixo Data URL com uma expressão equivalente a:

```javascript
/^data:image\/[a-zA-Z0-9.+-]+;base64,/
```

3. Obtenha `mimeType`, usando `image/jpeg` como padrão.
4. Rejeite imagem vazia com status `400`.
5. Aceite somente:

```text
image/jpeg
image/jpg
image/png
image/webp
```

6. Rejeite formatos inválidos com status `400`.
7. Calcule aproximadamente o tamanho do Base64:

```javascript
const tamanhoEstimadoBytes = Math.ceil((imagemBase64.length * 3) / 4);
```

8. Rejeite arquivos acima de 5 MB com status `413`.
9. Chame a OpenAI somente depois dessas validações.
10. Normalize a resposta: somente números válidos podem voltar como contador; caso contrário, retorne `null`.

Considere que uma imagem de 5 MB aumenta de tamanho ao virar Base64. O parser JSON do servidor precisa aceitar o payload. Configure um limite coerente, por exemplo:

```javascript
app.use(express.json({ limit: "12mb" }));
```

Faça isso no local correto da inicialização do servidor e sem adicionar um segundo parser conflitante.

Se o runtime não possuir `fetch`, use o cliente HTTP já adotado no projeto ou configure uma dependência apropriada. Se mantiver `fetch` nativo, o projeto deve usar Node.js 18 ou superior.

## 8. Tratamento de erros do backend

Implemente os seguintes comportamentos:

- sem `OPENAI_API_KEY`: erro interno claro de configuração;
- imagem ausente: `400`;
- MIME inválido: `400`;
- imagem maior que 5 MB: `413`;
- erro retornado pela OpenAI: preserve internamente a mensagem útil e use o status recebido quando apropriado;
- resposta vazia ou inválida da OpenAI: `502`;
- falha inesperada: `500`.

Formato de erro esperado:

```json
{
  "error": "Erro ao ler contadores por imagem",
  "message": "Detalhe técnico controlado"
}
```

Não devolva stack trace, chave, headers de autorização ou o Base64 da foto.

## 9. Rota

Registre a rota no módulo existente do assistente de IA ou no módulo equivalente do projeto:

```javascript
router.post(
  "/ler-contadores",
  autenticar,
  lerContadoresPorImagem
);
```

Monte esse router no prefixo:

```text
/api/assistente-ia
```

Resultado final:

```text
POST /api/assistente-ia/ler-contadores
```

Não restrinja a leitura somente a administradores se os operadores autenticados são responsáveis pelas movimentações. Use a mesma autorização permitida para abrir/criar uma movimentação, salvo regra explícita em contrário no projeto.

## 10. Integração no frontend

Localize o formulário real de criação/edição da movimentação. Adicione a captura de foto junto aos campos de contador, reutilizando o design system existente.

O formulário deve ter estados ou propriedades equivalentes a:

```javascript
contadorIn
contadorOut
```

Adicione também estados de interface equivalentes a:

```javascript
lendoContadores
erroLeituraContadores
resultadoLeituraContadores
```

Use um input de arquivo que funcione em celular:

```jsx
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  capture="environment"
/>
```

O atributo `capture="environment"` deve sugerir a câmera traseira em dispositivos móveis, mas o usuário também deve conseguir selecionar uma imagem quando o navegador permitir.

Crie um botão visível como:

```text
Ler contadores pela foto
```

O botão pode acionar programaticamente o input oculto. Durante o processamento:

- desabilite novas tentativas;
- mostre “Lendo contadores...”;
- não bloqueie permanentemente o restante do formulário;
- evite enviar a mesma imagem duas vezes por cliques repetidos.

## 11. Conversão e envio no frontend

Ao selecionar uma imagem:

1. valide o tipo;
2. valide o tamanho de até 5 MB antes do upload;
3. converta o `File` para Data URL usando `FileReader`;
4. obtenha o Base64 após a vírgula;
5. envie o MIME real de `file.type`;
6. use o cliente HTTP autenticado já existente;
7. faça a requisição para `/assistente-ia/ler-contadores` ou para o caminho compatível com a `baseURL` existente.

Exemplo conceitual:

```javascript
const converterArquivoParaDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });

const dataUrl = await converterArquivoParaDataUrl(file);
const imagemBase64 = dataUrl.split(",")[1];

const { data } = await api.post("/assistente-ia/ler-contadores", {
  imagemBase64,
  mimeType: file.type || "image/jpeg",
});
```

Não envie a imagem diretamente do navegador para a OpenAI.

Se o projeto já possui uma rotina segura de compressão/redimensionamento de imagens, reutilize-a antes da conversão para Base64. Não introduza compressão que possa tornar os dígitos ilegíveis. Preserve resolução suficiente para leitura dos contadores.

## 12. Preenchimento automático dos campos

Depois da resposta:

- se `contadorIn` for inteiro, preencha o campo IN;
- se `contadorOut` for inteiro, preencha o campo OUT;
- não substitua um campo por `null`, `undefined`, string vazia ou valor inválido;
- atualize somente esses dois campos e preserve todos os demais dados já digitados;
- permita edição manual imediatamente depois;
- não dispare o salvamento automaticamente.

Em React com um único objeto de formulário, faça atualização funcional:

```javascript
setForm((anterior) => ({
  ...anterior,
  ...(Number.isInteger(data.contadorIn)
    ? { contadorIn: String(data.contadorIn) }
    : {}),
  ...(Number.isInteger(data.contadorOut)
    ? { contadorOut: String(data.contadorOut) }
    : {}),
}));
```

Adapte o tipo para o padrão do formulário. Se inputs numéricos são controlados como string, use string na tela e converta no envio final. Se o formulário usa React Hook Form, Formik, Vue, Angular ou outro gerenciador, use a API nativa desse gerenciador.

## 13. Feedback ao usuário

Após uma leitura bem-sucedida:

- confiança alta: informe que os campos foram preenchidos e peça conferência;
- confiança média: preencha os valores disponíveis, mas destaque que o usuário deve conferir;
- confiança baixa ou ambos os contadores nulos: não invente valores; peça nova foto.

Mensagens sugeridas:

```text
Contadores preenchidos pela foto. Confira os valores antes de salvar.
```

```text
A leitura ficou com confiança média. Confira cuidadosamente os campos IN e OUT.
```

```text
Não foi possível ler os dois contadores com segurança. Tire outra foto, de frente, com boa iluminação e sem reflexo.
```

Mostre a `observacao` retornada quando ela ajudar o usuário, mas trate-a como texto informativo, nunca como HTML.

Em caso de erro HTTP, priorize:

```javascript
error.response?.data?.message ||
error.response?.data?.error ||
"Não foi possível ler os contadores."
```

No bloco `finally`, encerre o estado de carregamento e limpe o valor do input de arquivo para permitir selecionar novamente o mesmo arquivo.

## 14. Salvamento da movimentação

Confirme que o submit normal do formulário envia os valores preenchidos:

```javascript
{
  ...outrosDados,
  contadorIn:
    form.contadorIn === "" ? null : Number.parseInt(form.contadorIn, 10),
  contadorOut:
    form.contadorOut === "" ? null : Number.parseInt(form.contadorOut, 10)
}
```

Antes de enviar:

- aceite vazio como `null`;
- rejeite valores não inteiros;
- rejeite números negativos;
- não use `valor || null`, pois isso pode transformar zero de maneira não intencional;
- preserve as validações já existentes do formulário.

O backend deve repetir as validações importantes. Validação no frontend é apenas conveniência, não segurança.

## 15. Qualidade da foto

Inclua uma orientação curta perto do botão:

```text
Fotografe os dois contadores de frente, com boa iluminação, foco e sem reflexos.
```

Não tente determinar IN/OUT pela posição física dos contadores. A regra é exclusivamente:

```text
maior número = IN
menor número = OUT
```

Se os dois números forem iguais, a classificação fica ambígua. Nesse caso, a IA deve preferir retornar ambos como `null` com confiança baixa, ou explicar a ambiguidade na observação, em vez de escolher arbitrariamente.

## 16. Segurança e privacidade

Garanta que:

- o endpoint seja autenticado;
- a chave da OpenAI exista somente no backend;
- o Base64 não seja incluído em logs;
- a foto não seja persistida, salvo se o projeto tiver requisito explícito para isso;
- MIME e tamanho sejam validados no frontend e backend;
- a resposta da IA seja validada pelo schema;
- valores retornados pela IA não sejam tratados como confiáveis até passarem pela normalização;
- o usuário sempre possa corrigir os campos;
- erros não exponham segredos ou dados internos.

## 17. Testes obrigatórios

Adicione testes compatíveis com a estrutura do projeto. No mínimo, cubra:

### Backend

1. rejeita requisição sem autenticação;
2. rejeita `imagemBase64` ausente com `400`;
3. rejeita MIME não permitido com `400`;
4. rejeita imagem estimada acima de 5 MB com `413`;
5. envia à OpenAI um `input_image` como Data URL;
6. usa JSON Schema estrito;
7. transforma resposta válida em `contadorIn` e `contadorOut`;
8. retorna `null` quando a IA não lê com segurança;
9. trata erro da OpenAI;
10. trata resposta vazia ou JSON inválido;
11. cria e atualiza movimentações com os dois contadores.

Faça mock da chamada à OpenAI. Os testes automatizados não devem consumir créditos nem depender da rede.

### Frontend

1. botão abre seleção/câmera;
2. arquivo inválido é rejeitado;
3. arquivo acima de 5 MB é rejeitado;
4. estado de carregamento é exibido;
5. cliente autenticado chama o endpoint correto;
6. resposta válida preenche IN e OUT;
7. resposta parcial altera somente o campo válido;
8. confiança baixa exibe orientação;
9. falha da API preserva os valores já digitados;
10. submit inclui `contadorIn` e `contadorOut`.

## 18. Verificação manual

Além dos testes, valide manualmente:

1. abrir uma nova movimentação;
2. preencher alguns campos que não sejam os contadores;
3. selecionar uma foto válida;
4. confirmar que os demais campos não foram apagados;
5. confirmar que o maior valor apareceu no IN;
6. confirmar que o menor valor apareceu no OUT;
7. editar manualmente um dos valores;
8. salvar;
9. recarregar a movimentação;
10. confirmar que os valores persistiram;
11. testar foto desfocada;
12. testar foto com apenas um contador;
13. testar imagem com números externos, etiquetas ou voltímetro;
14. testar JPEG, PNG e WEBP;
15. testar sessão expirada.

## 19. Critérios de aceite

A tarefa só está concluída quando:

- existe um endpoint autenticado de leitura por imagem;
- a OpenAI é chamada exclusivamente pelo backend;
- a resposta usa JSON Schema estrito;
- a regra maior = IN e menor = OUT foi preservada;
- formatos e tamanho são validados;
- o frontend permite câmera ou seleção de imagem;
- os campos IN e OUT são preenchidos sem apagar o restante do formulário;
- o usuário pode revisar os valores;
- a movimentação persiste ambos os campos;
- falhas de leitura não geram números inventados;
- estados de carregamento, sucesso e erro são visíveis;
- testes e build/lint relevantes passam.

## 20. Formato da entrega

Ao finalizar:

1. liste os arquivos alterados;
2. explique resumidamente o fluxo completo;
3. informe migrations e variáveis de ambiente necessárias;
4. informe os comandos executados para teste/build/lint;
5. registre qualquer limitação encontrada;
6. não diga apenas “está pronto”: mostre evidências das verificações.

Implemente agora no repositório atual.

