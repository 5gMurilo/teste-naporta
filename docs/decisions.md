# naPorta: decisões técnicas e trade-offs

## Datas

- Criado em: 2026-10-21
- Última atualização: 2026-10-21

Este documento registra o que foi realmente implementado, por que, e o que cada escolha custa. Quando algo
diverge do plano original (`.specs/features/orders-api/`), a divergência está na seção "Desvios do plano".
Contratos HTTP exatos estão em [openapi.json](openapi.json); a ordem de entrega, em `.specs/`.

## Escopo entregue

API de pedidos (NestJS + PostgreSQL), cache-aside em Redis para o detalhe, SPA de validação (React + Vite),
monorepo pnpm com Turborepo, imagens Docker e Compose. O handoff original pedia somente a API; o cache, o
frontend, o Dockerfile e o Compose foram incluídos por solicitação posterior do usuário.

## 1. Estrutura: monólito modular e monorepo enxuto

- **Decisão:** um monólito NestJS em `apps/api` (módulos `auth`, `health`, `orders`, `cache`, `docs`,
  `common`) e uma SPA independente em `apps/web`. pnpm workspaces e Turborepo na raiz, um único lockfile.
- **Por quê:** o problema cabe em um processo; microsserviços, CQRS ou arquitetura hexagonal cerimonial não
  resolveriam nada do que o teste pede. Controllers cuidam de HTTP e DTO, services de casos de uso, e um
  repository concreto concentra as queries Prisma, sem interface genérica de CRUD.
- **Trade-off:** não há pacote compartilhado de tipos entre API e web. Os tipos públicos do frontend são
  locais e conferidos contra `docs/openapi.json` nos testes; se a duplicação crescer, extrair um pacote.

## 2. Persistência: PostgreSQL, Prisma 7 e ESM

- **Decisão:** PostgreSQL 17 é a fonte de verdade. Prisma 7 com `@prisma/adapter-pg`, gerador `prisma-client`
  com `moduleFormat = "esm"`, TypeScript `NodeNext`, Node >= 22.22.3. Migrations versionadas em
  `apps/api/prisma/migrations`, aplicadas por `migrate deploy` (nunca no startup da API).
- **Compatibilidade registrada:** o client gerado é ESM e roda no Node compilado sem depender do resolver do
  Jest. O loader `ts-node/esm` não resolve `@nestjs/swagger` (procura `.js.js`), por isso `dev` compila com
  `tsc --watch` e executa `dist/`; o export do OpenAPI também roda a partir do build.
- **`prisma generate` sem banco:** os scripts `prisma:generate` e `prisma:validate` usam uma `DATABASE_URL`
  de marcação quando ela não existe; nada conecta. Assim `pnpm build` funciona em um checkout limpo.
- **Trade-off:** o `postinstall` do Prisma precisa ser liberado explicitamente
  (`onlyBuiltDependencies` em `pnpm-workspace.yaml`), senão o motor de schema não é baixado.

## 3. Modelo de dados

| Escolha | Motivo | Custo |
| --- | --- | --- |
| Endereço em JSONB, sem identidade | Faz parte do pedido, é substituído por inteiro e não é consultado | Sem constraints por campo no banco; a validação está na borda |
| Itens em tabela 1:N (`OrderItem`) | Preços e descrições são linhas reais, com FK e índice | Substituir a coleção é uma operação de duas etapas dentro da transação |
| Preço em centavos inteiros (`INTEGER`) | Nenhum float em dinheiro | O total é calculado (`number`), nunca armazenado; chega a 100000000000 sem overflow porque a soma ocorre fora do `INTEGER` |
| Data de entrega como `DATE`; criação como `timestamptz` UTC | Dia civil não tem fuso; instante tem | O presenter extrai o dia por partes UTC; o web trata a data como texto |
| Exclusão lógica (`deletedAt`) | O pedido some das consultas, mas a linha e os itens permanecem | O `orderNumber` continua reservado: a unique inclui pedidos excluídos |
| Filtros `createdFrom` e `createdTo` em UTC, inclusivos por dia | O dia começa às 00:00:00Z e o fim é o início do dia seguinte (`createdAt >= início` e `createdAt < início do dia seguinte`), sem 23:59:59.999 | Quem pensa em fuso local precisa converter o dia para UTC antes de filtrar |
| `cacheRevision` interno | Versão do pedido para o cache (seção 8) | Coluna extra que nunca aparece em DTO nem em OpenAPI |

Índices: unique de `orderNumber`, `OrderItem(orderId)` e `Order(deletedAt, createdAt, id)` para o filtro de
ativos com a ordenação da lista. Nenhum índice por status foi criado sem medição.

## 4. Validação na borda

- **Decisão:** schemas Zod estritos (`strictObject`, nada de propriedade desconhecida nem `null` no lugar de
  ausente), aplicados uma única vez pelo `StandardSchemaValidationPipe` do Nest. As mesmas definições geram o
  OpenAPI. Datas são datas reais `YYYY-MM-DD`; query numérica é convertida explicitamente.
- **Regra acrescentada:** o caractere NUL é rejeitado em textos, porque o PostgreSQL não o armazena e a
  alternativa seria um 500 causado por entrada do cliente.
- **Limite de paginação:** `page` e `pageSize` que produziriam um `skip` maior que o inteiro de 32 bits são
  rejeitados com 400, em vez de falhar no banco.

## 5. Erros e observabilidade

- Todas as falhas HTTP seguem RFC 9457 (`application/problem+json`) com `code` estável e `requestId`.
  O `requestId` é um UUID gerado por requisição (um valor enviado pelo cliente é ignorado) e volta no header
  `X-Request-Id`.
- Erros desconhecidos viram 500 genérico. O log de falha é uma lista permitida de campos (requestId,
  método, rota sem query, status), nunca a exceção crua, corpo, Authorization ou documento.
- Só a violação de unique do índice `Order_orderNumber_key` vira 409; qualquer outra violação, inclusive
  de e-mail de usuário, continua sendo erro interno. O formato do erro do Prisma 7 com adapter foi
  confirmado contra um PostgreSQL real, não presumido.
- Observabilidade se limita a isso mais os contadores do cache (hit, miss, error), sem endpoint de métricas.

## 6. Autenticação demonstrativa

- JWT HS256 com `sub`, `email`, `iat`, `exp`, `iss` e `aud`; issuer, audience e algoritmo são verificados no
  guard global. Senha com argon2id. Credencial errada e e-mail inexistente dão a mesma resposta, e o caminho
  do e-mail inexistente verifica contra um hash descartável para que os dois custem o mesmo.
- O guard é global (`APP_GUARD`); só login e health são públicos, por metadata `@Public()`. `GET /` continua
  existindo, protegido, fora do contrato.
- **Limites verificados:** sem refresh token, cadastro, RBAC, isolamento por usuário ou throttling de login.
  Todo usuário autenticado vê todos os pedidos.

## 7. Concorrência e consistência de escrita

- **Escritas:** PATCH e DELETE começam por um `updateMany` condicional em `id` e `deletedAt IS NULL`, em
  transação `ReadCommitted`. Essa escrita trava a linha do pedido; um DELETE ou PATCH concorrente espera e
  reavalia a condição, então ninguém atualiza um pedido já excluído nem o ressuscita. Os itens só são
  trocados depois, com a linha travada. O índice único do banco arbitra disputas de `orderNumber`.
- **Provas:** rollback por trigger real no PostgreSQL, verificado em outra conexão; corridas com barreiras
  reais (`pg_stat_activity`), sem `sleep` como prova.
- **Leitura do detalhe:** pedido, itens e revisão vêm de um snapshot `RepeatableRead`, para que o cache nunca
  associe uma revisão a itens de outro instante.
- **Não garantido:** `count` e `findMany` da lista são consultas independentes, sem snapshot conjunto sob
  escrita concorrente. Não há ETag nem versão pública no PATCH; vale a ordem de efetivação.

## 8. Cache-aside em Redis (adicionado a pedido do usuário)

O handoff original excluía cache. Ele foi incluído depois, com este desenho:

- Só o **detalhe por ID** é cacheado. Listas, login, erros e 404 nunca entram.
- Chave versionada `naporta:v1:orders:{id}:detail`, TTL de 60 s (`CACHE_TTL_SECONDS`), payload
  `{ revision, data }` validado por schema estrito e pelo id.
- **Consistência:** toda leitura primeiro consulta no PostgreSQL uma projeção mínima (pedido ativo e
  `cacheRevision`) e só serve o cache se a revisão for exatamente a atual. Um GET antigo que grave depois de
  um PATCH ou DELETE não consegue servir dado velho, e a invalidação pós-commit (`DEL` depois do commit, fora da
  transação) é uma otimização, não a garantia: se ela falhar, a revisão ainda protege.
- **Custo assumido:** um hit ainda faz uma consulta pequena ao banco. Por isso **não se alega ganho de
  desempenho**: nenhuma medição foi feita.
- **Falha do Redis:** fail-open. Nunca bloqueia o startup nem o health. A fila offline do cliente é desligada
  e a fila de comandos é limitada. O prazo de `CACHE_TIMEOUT_MS` (200 ms) por operação é imposto no serviço,
  porque o timeout nativo do node-redis deixa de valer depois que o comando é escrito no socket (verificado
  contra um servidor que para de responder). Um comando que perde o prazo é apenas abandonado; GET, SET e DEL
  são idempotentes.
- Sem lock distribuído, outbox ou proteção contra stampede: a especificação não os exige.

## 9. OpenAPI

Gerado dos schemas Zod e dos decorators, com exemplos e as respostas 400/401/404/409/500 de cada rota.
`pnpm docs:openapi` exporta `docs/openapi.json` de forma determinística (chaves ordenadas, configuração
sintética, sem tocar PostgreSQL nem Redis) e `docs:openapi:check` falha se o arquivo versionado divergir.
`/docs` e `/docs-json` são públicos; os pedidos exigem Bearer.

## 10. Segurança HTTP

CORS permite exatamente a origem de `CORS_ORIGIN` (nenhuma quando ausente, nunca curinga) e expõe só
`Location` e `X-Request-Id`. Helmet vale em tudo; a CSP é omitida apenas nas páginas do Swagger UI, que
precisam de scripts inline. No container web, o Nginx envia uma CSP restrita a `self`.

## 11. Frontend

- SPA React 19 + Vite 8 + TypeScript estrito, sem SSR. shadcn/ui sobre Tailwind 4; React Router em modo
  declarativo. Estado em React, sem biblioteca de estado ou de formulário.
- **Sessão em memória:** o token não vai a storage, cookie nem URL. Recarregar a página encerra a sessão.
  Logout e 401 abortam requisições pendentes, para que uma resposta tardia não repovoe a tela.
- **Cliente HTTP único**, sem retry automático de nenhum método (repetir um POST poderia duplicar um pedido).
  Mensagens de erro são escritas por código da API em português; texto de exceção, `detail` em inglês e
  `requestId` nunca são exibidos.
- **Dinheiro e datas:** o formulário recebe centavos inteiros como texto; a exibição converte com aritmética
  inteira. A data de entrega é texto de data civil e jamais passa por `Date`.
- **PATCH:** só o que mudou; `customer`, endereço e itens vão sempre inteiros (a API os substitui por inteiro);
  ids de item nunca são enviados; sem alteração não há requisição.
- Validação do cliente é apenas estrutural. Os limites de negócio ficam na API e voltam por campo.
- Não existe tela de cadastro, dashboard, i18n nem tema escuro.

## 12. Testes

Jest ESM na API, Vitest e Testing Library na web, Playwright (Chromium) no fluxo ponta a ponta,
Testcontainers para PostgreSQL e Redis reais, Node test runner para os containers. Persistência, cache e
concorrência não usam mocks como prova. Falhas de escrita e de invalidação são induzidas na fronteira
(trigger no PostgreSQL, rejeição do `DEL`). Cobertura mínima de 80 % de linhas e 70 % de branches, imposta
nos dois apps. `pnpm check` encadeia todos os gates e propaga a falha de cada etapa.

## 13. Containers

- API: Dockerfile multi-stage, `node:22.22.3-slim`, instalação com lockfile congelado, runtime com
  `dist`, dependências de produção e `package.json`, usuário não-root, `HEALTHCHECK`. O alvo `migrate` é um
  job de uma execução; o alvo `seed` só roda sob demanda.
- Web: Nginx não-root servindo o build estático, com `/api/` repassado sem reescrever status, corpo ou
  headers, erro 502 do próprio Nginx como `problem+json` e fallback para a SPA somente em rotas visuais.
- Compose: PostgreSQL (volume `postgres_data` preservado), Redis sem porta publicada e sem persistência,
  `migrate` antes da API, portas somente em `127.0.0.1`. Sem deploy, push ou ambiente inferido.

## Desvios do plano

| Desvio | Motivo |
| --- | --- |
| CORS e helmet entregues como item extra | A especificação os exige, mas nenhuma tarefa os cobria |
| `dev` e `docs:openapi` executam código compilado | O loader `ts-node/esm` não importa `@nestjs/swagger` |
| Deadline do Redis no serviço, não no cliente | O timeout nativo não cobre comandos já escritos |
| `prisma:generate` com URL de marcação | `pnpm build` não pode exigir variáveis de ambiente |
| `JWT_SECRET` vazio no Compose em vez de interpolação obrigatória | A interpolação obrigatória quebraria `docker compose up postgres`; a API recusa o valor vazio com mensagem clara |
| Verificação com sonda de porta nos contextos de teste | O runtime de containers às vezes reporta pronto antes de a porta publicada aceitar conexões |

## Limitações verificadas

- Sem throttling de login, refresh token, RBAC ou isolamento por usuário.
- Sessão do navegador perdida no reload, por decisão.
- Redis único e sem alta disponibilidade; o ganho do cache não foi medido.
- Contagem e página da lista sem snapshot conjunto sob escrita concorrente.
- Os testes de browser usam Chromium; outros navegadores não foram exercitados.
- Nenhum deploy, push ou configuração de produção foi feito ou inferido.
