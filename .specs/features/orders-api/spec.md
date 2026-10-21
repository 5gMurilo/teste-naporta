# naPorta: API de pedidos, cache Redis e frontend de validação

**Status:** revisão 2 aprovada no Plannotator em 2026-10-21 (`decision: approved`). [Design](design.md), [tarefas](tasks.md) e [mapa de branches](branches.md) também aprovados na revisão conjunta. Implementação não iniciada e explicitamente bloqueada pelo usuário até nova autorização no chat, mesmo após aprovação dos documentos.
**Data:** 2026-10-21.
**Prioridade:** P0 obrigatório e P1 opcional, conforme o handoff. P1 nesta spec não significa MVP.
**Fontes:** `/Users/digitalrepublic/Downloads/naporta-codex-handoff/CODEX_HANDOFF.md` e `AGENTS.md`, lidos integralmente.
**Revisão 2:** incorpora as quatro anotações recebidas no Plannotator. Redis/cache-aside, Dockerfile/Compose completo e frontend React + Vite em Turborepo passam a ser obrigatórios nesta entrega. Essa decisão do usuário substitui as exclusões correspondentes do handoff original. Cenários de teste estão enumerados por camada abaixo.
**Adendo de execução:** após a aprovação, o usuário determinou uma branch por etapa de desenvolvimento e commits atômicos. A primeira etapa pode usar a branch atual; os merges serão feitos pelo usuário.

## Problem Statement

O teste técnico exige uma API Node.js de pedidos que possa ser instalada, executada e avaliada sem preparação obscura. O repositório já oferece bootstrap NestJS, Prisma e banco de testes descartável, mas ainda não implementa autenticação, persistência de pedidos nem seu contrato HTTP. Esta entrega completa o P0 original e os acréscimos solicitados na revisão: cache-aside Redis, execução containerizada e frontend simples para validar o fluxo completo.

## Goals

- [ ] Autenticar um usuário demonstrativo e proteger os cinco endpoints de pedidos.
- [ ] Entregar criação, listagem, detalhe, PATCH e exclusão lógica conforme o contrato abaixo.
- [ ] Preservar atomicidade, unicidade e filtros de datas sem deslocamentos de fuso.
- [ ] Documentar entradas, saídas e erros em OpenAPI coerente com o runtime.
- [ ] Reproduzir instalação, migrations, seed e testes a partir de checkout limpo.
- [ ] Demonstrar os gates de qualidade, sem substituir integração real por mocks.
- [ ] Demonstrar cache-aside no detalhe sem violar PATCH, soft delete ou disponibilidade da API.
- [ ] Validar login, filtros e CRUD por SPA React/Vite com shadcn/ui, TypeScript e Biome.
- [ ] Organizar API e web em pnpm workspaces com Turborepo e executar a stack por Compose.

## Baseline observado

Inspeção feita na branch `feat/postgres-testcontainers`, HEAD `f039f21`, com árvore de trabalho limpa antes desta spec. Não foram executados build, testes ou containers nesta etapa.

| Superfície | Evidência atual | Consequência para esta entrega |
| --- | --- | --- |
| Aplicação | `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts` | Bootstrap ESM e `GET /` existentes; reaproveitar sem reinicializar o projeto. |
| Stack declarada | `package.json`, `pnpm-lock.yaml` | pnpm 10.33.0; Node >=22.22.3; Nest 12.2.0; Prisma/client/adapter 7.10.1; Zod 4.6.7; Biome 2.5.15; Testcontainers 12.2.1. São versões declaradas, não uma certificação de compatibilidade nesta etapa. |
| Banco | `prisma/schema.prisma`, `src/prisma/prisma.service.ts` | Schema sem modelos; provider compartilhado com adapter PostgreSQL e lifecycle de conexão. |
| Empacotamento | `package.json` e `prisma/schema.prisma` | Aplicação `type: module`, gerador Prisma com `moduleFormat = "cjs"`; compatibilidade de geração/build/runtime é gate antes de escolher eventual correção. |
| Validação | `src/main.ts`, `src/common/validation.pipe.spec.ts` | Runtime usa class-validator; entradas novas usarão Zod. A migração não autoriza apagar testes legados para obter sucesso. |
| Integração | `test/integration/setup.ts` | PostgreSQL 17 Alpine por suite, porta dinâmica e restauração de `DATABASE_URL`; ainda sem migrations de negócio. |
| Infra local | `docker-compose.yml`, `README.md` | PostgreSQL persistente local já existe e deve ser aproveitado. |
| Memória | `.specs/STATE.md` | Snapshot cita branch main e integração pendente; git e código atuais prevalecem. Os planos históricos não serão sobrescritos. |

## Out of Scope

| Feature | Reason |
| --- | --- |
| Microserviços, CQRS, event sourcing, brokers, arquitetura hexagonal cerimonial e repositórios genéricos | Não resolvem necessidade do teste. |
| Cache de listas, autenticação ou ausência de pedido; cache distribuído além do Redis simples | Cache-aside solicitado somente para detalhe por ID; não ampliar superfícies de invalidação. |
| Refresh token, cadastro público, RBAC, isolamento por usuário e multi-tenancy | Autenticação demonstrativa; todo usuário autenticado acessa todos os pedidos. |
| Máquina de transição de status | Qualquer valor válido pode substituir qualquer outro. |
| CPF/CNPJ algorítmico, módulos/tabelas de cliente ou endereço, campo quantity | Não fazem parte do contrato. |
| SSR, Next.js, frontend elaborado, cadastro, dashboard analítico ou design system próprio | SPA de validação do fluxo, sem escopo de produto visual adicional. |
| Go, busca textual/parcial/case-insensitive, paginação infinita | API REST Node.js com filtros exatos e paginação por página. |
| Deploy, push, mudanças em banco de produção ou remoção de volumes existentes | Exigem autorização explícita separada; aprovação desta spec não as autoriza. |
| GitHub Actions, throttling de login e índices adicionais | P1, fora do aceite obrigatório. Dockerfile e Compose completo foram promovidos para escopo obrigatório na revisão. |

## Assumptions & Open Questions

As regras expressas no handoff são decisões fornecidas, não perguntas a reabrir. Os padrões não definidos estão abaixo e podem ser alterados na revisão.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Limite desta rodada | Construir a spec, validar e abrir Plannotator; parar antes de implementação | Pedido explícito de revisão assim que a spec estiver construída | Sim, pedido atual |
| Stack existente | Preservar pnpm, ESM, Nest, Prisma e PostgreSQL 17; não atualizar majors por conveniência | Já há bootstrap e lockfile; mudanças necessárias dependem de prova de incompatibilidade | Proposto |
| Zod no Nest | Preferir Standard Schema nativo; pipe fino somente se smoke test da versão instalada falhar | Documentação atual confirma suporte; ainda é necessário verificar o conjunto instalado e o Swagger | Proposto |
| Contrato de erros | Adotar RFC 9457, não outro envelope | É a preferência do handoff e fixa um único resultado testável | Proposto |
| Health de sucesso | `200` com `{"status":"ok","database":"up"}` após consulta real ao banco | O handoff fixa disponibilidade e status HTTP, mas não o corpo de sucesso | Proposto |
| Rota legada `GET /` | Manter `Hello World!` com autenticação exigida; as exceções públicas da API são login e health | Preserva a rota sem criar uma terceira exceção ao guard global; os testes HTTP legados precisarão incorporar autenticação | Proposto |
| Documentação pública | `/docs` e `/docs-json` acessíveis sem JWT, fora dos controllers de negócio | Permite descobrir a API e obter token pelo Swagger; não torna pedidos públicos | Proposto |
| Login | Email válido com trim/lowercase; senha string não vazia, sem trim; objeto estrito | Alinha login ao email persistido sem alterar a senha fornecida | Proposto |
| JWT/env | HS256; segredo com pelo menos 32 caracteres; `JWT_EXPIRES_IN` em segundos inteiros positivos; exemplo 3600 | Torna força mínima, algoritmo e unidade verificáveis sem segredo default | Proposto |
| CORS | Sem origens cross-origin permitidas quando `CORS_ORIGIN` ausente; quando presente, uma origem explícita | É configurável sem wildcard permissivo silencioso; múltiplas origens não foram pedidas | Proposto |
| Request ID | Gerar UUID por requisição e retornar `X-Request-Id`; o mesmo valor aparece no Problem Details e nos logs de falha | Define correlação verificável sem confiar em identificadores arbitrários de entrada | Proposto |
| Erros HTTP nativos adicionais | Preservar status; usar `HTTP_ERROR` para casos não presentes na matriz; não revelar detalhes internos | O filtro não deve transformar 403/405/413 ou 404 de rota em 400/500 genérico | Proposto |
| UF | Aceitar duas letras ASCII após trim/uppercase, sem catálogo de UFs | O contrato especifica formato de duas letras, sem enumeração adicional | Proposto |
| Lista vazia | `data: []`, `total: 0`, `totalPages: 0`; página além da última retorna lista vazia com a meta solicitada | Fecha os casos de paginação sem inventar um erro para coleção vazia | Proposto |
| Concorrência entre PATCHes | Sem ETag/versionamento; escritas bem-sucedidas seguem a ordem de efetivação, sem coleções parcialmente substituídas | Não há contrato de controle otimista no handoff; atomicidade e proteção contra soft delete continuam obrigatórias | Proposto |
| Ordem dos itens na resposta | Não prometer ordenação pública da coleção; verificar itens por identidade/conteúdo, não por posição | O contrato não inclui posição nem sort de itens | Proposto |
| Seed repetido | Reservar `SEED-NP-0001` a `SEED-NP-0012`; criar pedidos ausentes e manter os já existentes, inclusive soft-deleted; atualizar credenciais do usuário por email | Não duplica itens, não ressuscita registros e não sobrescreve pedidos externos ao conjunto reservado | Proposto |
| `@CurrentUser()` | Não criar inicialmente; só adicionar se houver consumo real do principal e repetição a remover | Nenhuma rota P0 depende de proprietário; não criar decorator cosmético nem endpoint extra | Proposto |
| Monorepo | `apps/api` recebe a API existente; `apps/web` recebe React/Vite; um pnpm-lock.yaml e Turborepo na raiz | Atende à preferência explícita sem criar pacotes compartilhados antes de existir duplicação real | Sim para Turborepo; paths propostos |
| Fluxo visual | Login, lista/filtros, detalhe, criação, edição e confirmação de exclusão; textos pt-BR, sem SSR | É o menor frontend que valida todas as operações solicitadas | Proposto |
| Sessão no navegador | Token somente em memória; reload/logout encerra a sessão; 401 limpa sessão e leva ao login | Evita persistência de Bearer em localStorage/cookies e não inventa refresh token | Proposto |
| Preço no formulário | Entrada explícita em centavos inteiros; exibição BRL com formatação pt-BR | Evita conversão monetária por float; exemplo 4990 exibe R$ 49,90 | Proposto |
| Cache | Detalhe por ID; TTL 60 segundos; chave versionada; invalidar após commit de PATCH/DELETE; Redis é otimização, PostgreSQL é fonte de verdade | Concretiza cache-aside solicitado sem cachear listagens | Sim para cache; detalhes propostos |
| Consistência do cache | Verificar pedido ativo/revisão no PostgreSQL antes de servir cache; revisão interna inteira aumenta em PATCH/DELETE | Só DEL + TTL não protege contra repopulação concorrente ou falha de invalidação; a consulta enxuta preserva soft delete e evita recarregar itens no hit | Proposto |
| Falha do Redis | Fail-open para PostgreSQL, sem falhar startup/health por Redis; limite de 200 ms por operação de cache, sem espera por reconexão na requisição | Não transformar otimização em dependência de disponibilidade; não é promessa de latência total da API | Proposto |
| Empacotamento | Dockerfiles multi-stage API/web, runtime não-root; Compose com postgres, redis, api e web; migrations explícitas antes de iniciar API | Torna a stack reproduzível sem seed automático ou migração de produção inferida | Sim para Docker/Compose; execução proposta |
| Testes web | Vitest + Testing Library para lógica/componentes e Playwright para fluxo em navegador real | Separa feedback rápido de prova ponta a ponta sem trocar os testes reais da API | Proposto |
| Dados demonstrativos variados | Os 12 pedidos novos do seed cobrem os cinco status e ao menos três dias UTC distintos de criação | Torna a demonstração dos filtros e o cenário I02 objetivos, sem afetar pedidos já existentes | Proposto |
| Branches e commits | Uma branch por etapa/fase de desenvolvimento; primeira em feat/postgres-testcontainers; seguintes encadeadas a partir da etapa anterior; um commit atômico por tarefa após seu gate | Preserva dependências e separa mudanças para revisão/merge posterior pelo usuário | Sim, instrução posterior à aprovação |

**Open questions:** none. Todas as decisões não explícitas estão registradas como propostas acima; a revisão pode substituí-las. Nenhuma aprovação ou execução de teste é presumida.

## Contrato normativo

As tabelas desta seção definem os valores esperados pelos critérios de aceite. Exemplos não substituem limites ou regras.

### Superfície HTTP

| Método | Rota | Autorização | Sucesso |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | Pública | 200, `LoginResponse` |
| GET | `/api/v1/health` | Pública | 200 com banco disponível; 503 caso contrário |
| POST | `/api/v1/orders` | Bearer JWT | 201, `OrderResponse`, `Location: /api/v1/orders/{id}` |
| GET | `/api/v1/orders` | Bearer JWT | 200, `ListOrdersResponse` |
| GET | `/api/v1/orders/:id` | Bearer JWT | 200, `OrderResponse` |
| PATCH | `/api/v1/orders/:id` | Bearer JWT | 200, `OrderResponse` |
| DELETE | `/api/v1/orders/:id` | Bearer JWT | 204, zero bytes de corpo |

Path `id` é UUID. Todas as entradas HTTP são estritas, incluindo objetos aninhados e queries. `null` não equivale a campo omitido. Datas são datas reais no formato exato indicado, não normalizadas permissivamente pelo JavaScript.

### Entradas de pedidos

| Campo | CreateOrderRequest | UpdateOrderRequest | Validação/normalização |
| --- | --- | --- | --- |
| orderNumber | Obrigatório | Opcional | String, trim, 1..64; igualdade case-sensitive; único inclusive após exclusão |
| status | Opcional, default PENDING | Opcional | PENDING, PROCESSING, SHIPPED, DELIVERED ou CANCELED |
| expectedDeliveryDate | Obrigatório | Opcional | Data civil real `YYYY-MM-DD`; data passada permitida |
| customer | Obrigatório | Opcional; substitui objeto inteiro | name: trim, 1..160; document: trim, 1..32, sem algoritmo CPF/CNPJ |
| deliveryAddress | Obrigatório | Opcional; substitui objeto inteiro | Campos na tabela abaixo |
| items | Obrigatório | Opcional; substitui coleção inteira | 1..50 itens; objetos sem id/quantity; descrição trim 1..240; priceCents inteiro 0..2000000000 |

| Campo de deliveryAddress | Regra após trim |
| --- | --- |
| street | String 1..160 |
| number | String 1..20 |
| complement | String opcional 0..100; ausência permitida |
| neighborhood | String 1..100 |
| city | String 1..100 |
| state | String com duas letras A..Z, normalizada para uppercase |
| postalCode | String com exatamente oito dígitos |

PATCH exige ao menos um campo no topo. `customer` e `deliveryAddress`, quando presentes, exigem seus campos obrigatórios completos. `items` omitido mantém itens e seus IDs; `items: []` é inválido. `id`, `createdAt`, `updatedAt`, `deletedAt` e qualquer propriedade desconhecida são rejeitados em escrita.

### Query da lista

| Campo | Padrão | Regra |
| --- | --- | --- |
| orderNumber | Ausente | String com trim, 1..64; igualdade exata, sem busca parcial |
| status | Ausente | Um valor do enum |
| createdFrom | Ausente | Data real YYYY-MM-DD; `createdAt >= 00:00:00Z` desse dia |
| createdTo | Ausente | Data real YYYY-MM-DD; `createdAt < 00:00:00Z` do dia seguinte |
| page | 1 | String decimal de inteiro positivo, convertida explicitamente; mínimo 1 |
| pageSize | 20 | String decimal de inteiro positivo, convertida explicitamente; 1..100 |

Rejeitar intervalos invertidos, strings numéricas vazias/fracionárias e chaves repetidas que produzam array/objeto em vez de valor escalar. Os filtros se combinam por AND. Ordenação fixa: `createdAt DESC, id DESC`. `total` usa exatamente os mesmos filtros; `totalPages = ceil(total/pageSize)`.

### Saídas e valores de referência

| Schema | Campos públicos exatos |
| --- | --- |
| LoginResponse | accessToken string; tokenType `Bearer`; expiresIn número de segundos igual ao TTL configurado |
| OrderResponse | id UUID; orderNumber; status; expectedDeliveryDate YYYY-MM-DD; customer {name, document}; deliveryAddress; items [{id UUID, description, priceCents}]; totalCents; createdAt e updatedAt ISO UTC |
| OrderSummaryResponse | id; orderNumber; status; expectedDeliveryDate; customer {name, document}; createdAt ISO UTC |
| ListOrdersResponse | data: OrderSummaryResponse[]; meta {page, pageSize, total, totalPages} |
| ProblemDetails | type `about:blank`; title correspondente ao status HTTP; status numérico; detail seguro; instance com path sem query; code; requestId UUID |
| ValidationProblemDetails | ProblemDetails com errors: [{field, message}], sem valores de entrada |

`totalCents` é soma calculada, não persistida; centavos inteiros representam BRL. Com itens 4990 e 0, o total é 4990. Com 50 itens de 2000000000, o total é 100000000000, sem overflow de INTEGER intermediário. A lista não contém itens, endereço, updatedAt ou totalCents. `deletedAt`, `passwordHash`, campos internos e principal JWT decodificado nunca aparecem nos DTOs; o token de login é a saída intencional de autenticação.

### Matriz de erros

| Condição | HTTP | code |
| --- | --- | --- |
| Body, path ou query inválidos, inclusive JSON malformado | 400 | VALIDATION_ERROR |
| Bearer ausente, inválido, expirado, com issuer/audience incorretos | 401 | UNAUTHORIZED |
| Senha incorreta ou email inexistente | 401 | INVALID_CREDENTIALS |
| Pedido inexistente ou soft-deleted | 404 | ORDER_NOT_FOUND |
| orderNumber duplicado, inclusive soft-deleted | 409 | ORDER_NUMBER_ALREADY_EXISTS |
| Banco indisponível no health | 503 | SERVICE_UNAVAILABLE |
| Falha inesperada | 500 | INTERNAL_SERVER_ERROR |

Erros usam `Content-Type: application/problem+json`. Email inexistente e senha errada retornam o mesmo detail seguro. Falha inesperada retorna detail genérico. `P2002` só representa conflito de pedido quando a restrição é a unique de `orderNumber`; outros erros não são recategorizados por conveniência.

### Persistência e operações

| Entidade | Contrato persistente |
| --- | --- |
| User | id UUID PK; email único lowercase; passwordHash seguro; createdAt/updatedAt |
| Order | id UUID PK; orderNumber unique; status enum default PENDING; expectedDeliveryDate PostgreSQL DATE; customerName/customerDocument texto; deliveryAddress JSONB; createdAt/updatedAt instantes UTC; deletedAt nullable; cacheRevision inteiro interno, default 1, incrementado atomicamente em PATCH/DELETE |
| OrderItem | id UUID PK; orderId FK com índice; description texto; priceCents PostgreSQL INTEGER, respeitando os limites de entrada |

Não há tabela de cliente/endereço ou total redundante. Migrations são versionadas; um PrismaClient compartilhado na aplicação usa adapter PostgreSQL e encerra conexões no lifecycle. A lista projeta somente campos de resumo, sem carregar itens; detalhe projeta os campos públicos necessários. Filtro, sort e paginação são executados no banco, nunca sobre todas as linhas em memória. Não criar N+1. Índices adicionais dependem das queries/plans, não de checklist.

`cacheRevision` é metadata interna para consistência, introduzida pelo acréscimo de cache. Nunca aparece em DTO/OpenAPI público. A mudança de revisão ocorre na mesma transação dos dados/itens ou soft delete; rollback não avança a revisão persistida. Os paths de baseline acima são os observados antes da reorganização, não paths finais do monorepo.

Criação com itens é atômica. PATCH de campos e substituição de itens formam uma única transação. DELETE é condicional sobre `id` e `deletedAt: null`. Operações concorrentes não podem ressuscitar pedido nem efetivar atualização em pedido já excluído. SQL bruto só com justificativa concreta; nenhuma concatenação de entrada do usuário.

## User Stories

### S1: Executar uma base persistente e segura (P0)

Como avaliador, quero iniciar a API e seu banco com configuração validada para verificar o produto em um ambiente reproduzível.

**Acceptance Criteria**
1. The application SHALL compilar e iniciar com a stack compatível registrada no lockfile, TypeScript strict e os modelos persistentes definidos nesta spec. **BOOT-01**
2. WHEN migrations versionadas são aplicadas a PostgreSQL vazio THEN the database SHALL conter User, Order e OrderItem com tipos, unicidade e integridade referencial definidos no contrato persistente. **BOOT-02**
3. IF a configuração de startup contiver DATABASE_URL inválida ou JWT_SECRET ausente/menor que 32 caracteres THEN the application SHALL falhar antes de escutar HTTP sem imprimir valores sensíveis. **BOOT-03**
4. WHEN o processo é encerrado após inicialização THEN the application SHALL liberar sua instância compartilhada de PrismaClient. **BOOT-04**
5. WHEN o health é chamado com banco acessível THEN the API SHALL retornar 200 e exatamente `{"status":"ok","database":"up"}` após verificar conexão real. **BOOT-05**
6. IF o banco ficar indisponível após a aplicação iniciar THEN the health endpoint SHALL retornar 503 SERVICE_UNAVAILABLE no formato de erro definido. **BOOT-06**

**Independent Test:** aplicar migrations em banco descartável, inspecionar schema, iniciar com env válido/inválido e provocar indisponibilidade apenas no banco de prova; verificar fechamento das conexões.

### S2: Obter token e acessar pedidos (P0)

Como avaliador, quero usar o usuário do seed para acessar a API sem expor credenciais ou criar um sistema de usuários fora do escopo.

**Acceptance Criteria**
1. WHEN credenciais corretas do usuário de seed são enviadas ao login THEN the API SHALL retornar 200 com LoginResponse e JWT válido pelo TTL configurado. **AUTH-01**
2. The JWT SHALL usar somente os claims de aplicação sub/email e os claims temporais/de validação iat/exp/iss/aud, sem senha, hash ou documento de cliente. **AUTH-02**
3. IF o email não existir ou a senha estiver incorreta THEN the login endpoint SHALL retornar 401 INVALID_CREDENTIALS com o mesmo detail seguro nos dois casos. **AUTH-03**
4. IF uma rota de pedidos receber token ausente, assinatura inválida, token expirado, issuer incorreto ou audience incorreta THEN the API SHALL retornar 401 UNAUTHORIZED. **AUTH-04**
5. WHEN login ou health são chamados sem Bearer THEN the global guard SHALL permitir seu processamento por metadata de `@Public()`. **AUTH-05**
6. WHILE uma rota não possuir metadata pública THEN the global guard SHALL exigir autenticação, inclusive no GET / legado. **AUTH-06**
7. WHEN dois usuários válidos autenticados consultam o mesmo pedido ativo THEN the API SHALL permitir acesso a ambos sem filtro de proprietário. **AUTH-07**
8. The application SHALL usar hash seguro argon2 ou bcrypt para verificar senhas, sem persistir ou registrar senha em texto puro. **AUTH-08**

**Independent Test:** login contra usuário real semeado, verificar JWT com configuração de teste, variar assinatura/tempo/issuer/audience e testar metadata/bypass do guard. `@CurrentUser()` só terá testes se for necessário e criado.

### S3: Criar, detalhar, editar e excluir pedidos (P0)

Como usuário autenticado, quero manter pedidos e itens com respostas públicas previsíveis e sem exclusão física.

**Acceptance Criteria**
1. WHEN um CreateOrderRequest válido é enviado THEN the API SHALL retornar 201 com OrderResponse persistido e Location relativo `/api/v1/orders/{id}`. **ORDER-01**
2. WHEN a criação omite status THEN the new order SHALL ter status PENDING. **ORDER-02**
3. WHEN um pedido ativo é solicitado pelo UUID THEN the API SHALL retornar 200 com todos os campos de OrderResponse e somente os campos públicos definidos. **ORDER-03**
4. WHEN o pedido contém itens de 4990 e 0 centavos THEN the OrderResponse SHALL retornar totalCents igual a 4990. **ORDER-04**
5. WHEN um PATCH válido omite items THEN the API SHALL manter a coleção e os IDs de itens existentes. **ORDER-05**
6. WHEN um PATCH válido inclui items THEN the API SHALL substituir integralmente a coleção por seus novos itens na mesma transação da atualização do pedido. **ORDER-06**
7. WHEN um PATCH inclui customer ou deliveryAddress completo THEN the API SHALL substituir o objeto enviado por inteiro, preservando os outros campos omitidos do pedido. **ORDER-07**
8. WHEN um PATCH solicita qualquer status do enum, independentemente do status anterior THEN the API SHALL retornar 200 com o status solicitado. **ORDER-08**
9. WHEN DELETE encontra pedido ativo THEN the API SHALL preencher deletedAt sem remover Order/OrderItem e retornar 204 com corpo vazio. **ORDER-09**
10. IF GET detail, PATCH ou DELETE receber UUID inexistente ou de pedido excluído THEN the API SHALL retornar 404 ORDER_NOT_FOUND. **ORDER-10**
11. IF dois pedidos distintos em criação ou alteração disputarem o mesmo orderNumber THEN the database SHALL efetivar no máximo uma reserva desse número e a API retornar 409 ORDER_NUMBER_ALREADY_EXISTS para o conflito conhecido. **ORDER-11**
12. IF ocorrer falha durante criação com itens ou PATCH com substituição de itens THEN the database SHALL reverter toda essa operação, mantendo o estado anterior sem gravação parcial. **ORDER-12**
13. WHEN PATCH e DELETE concorrem no mesmo pedido THEN the system SHALL impedir atualização efetivada após a exclusão lógica e impedir ressurreição do registro. **ORDER-13**
14. WHEN um pedido usa a previsão 2026-11-03 sob diferentes fusos do processo THEN the API SHALL persistir DATE e responder exatamente 2026-11-03. **ORDER-14**
15. WHEN um pedido contém 50 itens de 2000000000 centavos THEN the OrderResponse SHALL retornar totalCents igual a 100000000000. **ORDER-15**

**Independent Test:** exercer o ciclo HTTP com PostgreSQL; inspecionar persistência após DELETE; induzir rollback e concorrência com sincronização controlada, sem sleeps como prova; executar conversão de DATE em UTC e America/Sao_Paulo. Comparar coleções de itens sem depender de posição.

### S4: Encontrar pedidos com filtros e paginação (P0)

Como usuário autenticado, quero combinar filtros e navegar por resultados sem incluir pedidos excluídos ou carregar itens desnecessários.

**Acceptance Criteria**
1. WHEN GET orders é chamado sem query THEN the API SHALL retornar página 1 com pageSize 20 no formato ListOrdersResponse. **LIST-01**
2. WHEN filtros válidos são combinados THEN the API SHALL selecionar somente pedidos ativos que satisfaçam todos os filtros do contrato de query. **LIST-02**
3. WHEN createdFrom e createdTo são 2026-10-21 THEN the API SHALL incluir instantes a partir de 2026-10-21T00:00:00.000Z e excluir instantes a partir de 2026-10-22T00:00:00.000Z. **LIST-03**
4. WHEN existem pedidos com createdAt empatado THEN the API SHALL ordená-los por id DESC dentro da ordem global createdAt DESC. **LIST-04**
5. WHEN uma página é consultada THEN the API SHALL retornar meta com total do mesmo filtro e totalPages igual a ceil(total/pageSize), inclusive totalPages 0 quando total 0. **LIST-05**
6. The list query SHALL projetar somente os campos de OrderSummaryResponse, sem consulta de itens ou filtragem/paginação em memória. **LIST-06**
7. WHEN uma busca por ` NP-2026-0001 ` encontra NP-2026-0001 e np-2026-0001 THEN the API SHALL retornar somente NP-2026-0001. **LIST-07**

**Independent Test:** fixtures com datas antes/no/depois dos limites, número parcialmente coincidente, status variados, empates e soft delete; inspecionar a seleção Prisma separadamente dos testes de resultado HTTP.

### S5: Rejeitar entradas fora do contrato sem inventar regras (P0)

Como consumidor, quero erros por campo e normalização explícita, com as mesmas regras documentadas no Swagger.

**Acceptance Criteria**
1. IF qualquer entrada violar um tipo, formato, obrigatoriedade ou limite das tabelas de entrada/query THEN the API SHALL retornar 400 VALIDATION_ERROR com errors por campo, sem valores sensíveis. **VAL-01**
2. IF body, objeto aninhado ou query contiver propriedade desconhecida THEN the API SHALL retornar 400 VALIDATION_ERROR. **VAL-02**
3. WHEN textos com espaços externos e state `sp` são enviados em pedido válido THEN the API SHALL persistir textos com trim e state SP. **VAL-03**
4. IF PATCH estiver vazio, items estiver vazio, objeto customer/endereço estiver incompleto ou createdFrom for maior que createdTo THEN the API SHALL retornar 400 VALIDATION_ERROR. **VAL-04**
5. WHEN previsão passada válida e documento não vazio que não seja CPF/CNPJ são enviados THEN the API SHALL aceitar esses campos sem regras adicionais de negócio. **VAL-05**
6. IF expectedDeliveryDate ou filtro de data receber 2026-02-30 ou timestamp no lugar de data civil THEN the API SHALL retornar 400 VALIDATION_ERROR. **VAL-06**

**Independent Test:** tabelas de casos nos mínimos/máximos e logo fora deles; preço -1, 0, 1.5, 2000000000 e 2000000001; 0/1/50/51 itens; pageSize 0/1/100/101; números vazios/fracionários; UUID inválido; propriedades privadas, quantity e null.

### S6: Entender falhas sem vazamento de dados (P0)

Como consumidor e operador, quero erros uniformes e correlação suficiente para investigar falhas sem PII nos logs.

**Acceptance Criteria**
1. WHEN uma condição da matriz de erros ocorre THEN the API SHALL retornar o status/code da matriz e o schema ProblemDetails com content-type application/problem+json. **ERR-01**
2. WHEN há erro de validação THEN the API SHALL retornar ValidationProblemDetails com caminhos de campo e mensagens sem copiar senha, token ou documento. **ERR-02**
3. IF Prisma lançar P2002 relativo à unique orderNumber, inclusive após soft delete THEN the API SHALL retornar 409 ORDER_NUMBER_ALREADY_EXISTS. **ERR-03**
4. IF Prisma lançar erro de integridade ou unique não relacionado a orderNumber THEN the error mapper SHALL não convertê-lo em ORDER_NUMBER_ALREADY_EXISTS. **ERR-04**
5. IF ocorrer falha inesperada THEN the API SHALL retornar 500 INTERNAL_SERVER_ERROR genérico sem stack trace, SQL, credenciais ou detalhes do driver. **ERR-05**
6. WHEN uma falha inesperada é registrada THEN the application SHALL emitir log estruturado com requestId, método e rota sem corpo, query sensível, Authorization, senha, passwordHash ou documento. **ERR-06**
7. WHEN a API responde a uma requisição THEN the response SHALL conter X-Request-Id UUID, igual ao requestId do Problem Details quando houver erro. **ERR-07**
8. WHEN o filtro recebe uma HttpException nativa fora da matriz THEN the API SHALL preservar seu status HTTP com envelope seguro e code HTTP_ERROR. **ERR-08**

**Independent Test:** comparar status/code/content-type de cada falha; injetar erros de infraestrutura e capturar logs/DTOs para assegurar ausência de sentinelas sensíveis.

### S7: Avaliar o contrato pelo Swagger e pela documentação (P0)

Como avaliador, quero exemplos executáveis e documentação derivada das regras efetivas, não reflection vazia.

**Acceptance Criteria**
1. WHEN /docs e /docs-json são acessados THEN the application SHALL disponibilizar Swagger UI e OpenAPI 3.x com todas as sete operações versionadas e scheme bearerAuth. **DOC-01**
2. The OpenAPI document SHALL conter schemas separados LoginRequest, LoginResponse, CreateOrderRequest, UpdateOrderRequest, OrderResponse, OrderSummaryResponse, ListOrdersResponse, ProblemDetails e ValidationProblemDetails. **DOC-02**
3. The OpenAPI document SHALL representar obrigatoriedade, estriteza, formatos, enum, limites, defaults, parâmetros, segurança e exemplos do contrato normativo, derivando regras de entrada dos schemas Zod. **DOC-03**
4. The OpenAPI document SHALL documentar sucessos e os erros 400/401/404/409/500 nas rotas relevantes, 503 no health, Location no POST e DELETE 204 sem response body. **DOC-04**
5. WHEN docs:openapi é executado duas vezes com a mesma versão/configuração THEN the command SHALL produzir o mesmo documento sem depender de banco de produção ou dados variáveis. **DOC-05**
6. The README and decisions documentation SHALL cobrir o roteiro de execução, contrato e trade-offs enumerados na seção de entrega reproduzível. **DOC-06**

**Independent Test:** gerar JSON, validar conteúdo e comparar duas exportações; conferir required/optional do PATCH, security pública versus Bearer e ausência de schema de corpo no 204; reproduzir os curls do README em banco de prova.

### S8: Reproduzir seed, execução e verificação (P0)

Como avaliador, quero rodar comandos documentados, com dados demonstrativos repetíveis e gates que não escondem falhas.

**Acceptance Criteria**
1. WHEN PostgreSQL local é iniciado via Compose THEN the service SHALL ter volume persistente de desenvolvimento, healthcheck e porta configurável publicada em loopback, sem remoção automática de dados existentes. **OPS-01**
2. WHEN db:seed é executado duas vezes em banco migrado THEN the database SHALL conter um usuário por SEED_USER_EMAIL e ao menos 12 pedidos determinísticos, cada um com 1..3 itens, sem duplicar pedidos ou itens. **OPS-02**
3. WHEN o seed encontra pedidos fora do conjunto reservado THEN the seed SHALL preservar esses pedidos e seus itens sem alteração. **OPS-03**
4. The application SHALL não executar seed automaticamente no startup de produção nem versionar .env ou segredos em .env.example. **OPS-04**
5. WHEN os comandos obrigatórios da seção de scripts são executados no ambiente documentado THEN the project SHALL oferecer seus efeitos declarados e retornar exit code diferente de zero em caso de falha. **OPS-05**
6. WHEN a suite de integração inicia THEN the test harness SHALL provisionar PostgreSQL Testcontainers exclusivo, aplicar migrations reais e exercitar Nest/Supertest sem substituir persistência por SQLite, mock ou banco externo. **QA-01**
7. WHEN um teste de integração termina e o próximo começa THEN the suite SHALL fornecer dados isolados e determinísticos, sem dependência da ordem de execução. **QA-02**
8. WHEN a suite termina ou falha após adquirir recursos THEN the harness SHALL fechar app/Prisma/container e restaurar o ambiente alterado. **QA-03**
9. IF Docker não estiver disponível THEN the integration command SHALL falhar com diagnóstico explícito, sem skip, fallback externo ou resultado de sucesso. **QA-04**
10. WHEN test:coverage é executado THEN the business/validation/DTO/guard/error code SHALL atingir pelo menos 80% de lines e 70% de branches com exclusões justificadas apenas para bootstrap/gerados. **QA-05**
11. WHEN o gate check é executado THEN the project SHALL exigir lint/format:check, typecheck, build, unitários/contrato, cobertura, integração, E2E web e smoke de containers definidos nesta spec sem ignorar falhas. **QA-06**
12. WHEN a última tarefa de implementação estiver commitada THEN the independent verifier SHALL produzir validation.md com resultado por critério, evidência file:line e sensor de discriminação em scratch isolado, sem alterar a árvore real. **QA-07**
13. WHEN a suite de integração de cache é executada THEN the harness SHALL usar Redis real descartável e PostgreSQL Testcontainers para comprovar hit, TTL, invalidação e falhas sem mocks de persistência/cache. **QA-08**
14. WHEN test:e2e:web é executado THEN the browser suite SHALL validar login, criação, filtros, edição e exclusão com frontend, API, PostgreSQL e Redis reais em ambiente isolado. **QA-09**

**Independent Test:** executar roteiro em checkout/scratch e banco descartável; repetir seed, preservar sentinela externa ao seed, induzir setup parcial e Docker indisponível em processo de prova. Validar relatórios de cobertura e conclusão independentemente do autor.

### S9: Ler detalhes por cache-aside com consistência (obrigatório na revisão)

Como avaliador, quero observar cache miss/hit e invalidação real sem que Redis esconda uma edição ou exponha pedido excluído.

**Acceptance Criteria**
1. WHEN GET detail encontra pedido ativo sem entrada válida no cache THEN the API SHALL consultar seu detalhe no PostgreSQL e armazenar OrderResponse com TTL configurado, padrão 60 segundos. **CACHE-01**
2. WHEN GET detail encontra entrada válida da mesma revisão de pedido ativo THEN the API SHALL retornar OrderResponse equivalente ao banco sem recarregar a relação de itens. **CACHE-02**
3. WHEN PATCH ou DELETE é commitado THEN the application SHALL tentar invalidar explicitamente a entrada anterior no Redis, sem invalidar por operação revertida. **CACHE-03**
4. IF Redis estiver indisponível, exceder o limite de operação ou contiver payload inválido THEN the API SHALL ignorar o cache e responder pelo PostgreSQL, sem pendurar a requisição aguardando reconexão. **CACHE-04**
5. WHEN uma leitura de detalhe começa após conclusão de PATCH ou DELETE THEN the API SHALL observar a nova revisão ou 404, mesmo se DEL falhar ou uma leitura antiga repopular o cache. **CACHE-05**
6. The application SHALL armazenar no Redis somente detalhes de pedidos encontrados, nunca listas, credenciais, JWT, respostas de erro ou 404. **CACHE-06**
7. WHEN entradas de cache são criadas THEN the application SHALL usar chave versionada `naporta:v1:orders:{id}:detail`, TTL finito e payload com revisão interna separada do DTO público. **CACHE-07**
8. WHEN cache é utilizado THEN the application SHALL registrar contadores verificáveis de hit/miss/error sem payload ou PII, encerrando a conexão Redis no shutdown. **CACHE-08**

**Independent Test:** Redis real para GET/SET/TTL/DEL; comparar o response de miss/hit, contar carregamentos de itens, coordenar GET antigo versus PATCH/DELETE e induzir falha de DEL com recuperação do Redis sem permitir retorno stale.

### S10: Validar o fluxo em uma SPA simples (obrigatório na revisão)

Como avaliador, quero executar o fluxo completo pelo navegador sem escrever curls, usando uma interface pequena e funcional.

**Acceptance Criteria**
1. The frontend SHALL ser SPA React + Vite, TypeScript strict, componentes shadcn/ui e Biome, sem SSR ou servidor de renderização React em produção. **WEB-01**
2. WHEN credenciais corretas são enviadas na tela de login THEN the frontend SHALL guardar Bearer somente em memória e abrir a lista de pedidos, sem expor token na URL. **WEB-02**
3. IF a sessão estiver ausente ou uma chamada protegida retornar 401 THEN the frontend SHALL limpar o estado autenticado e exibir login com indicação de sessão expirada quando aplicável. **WEB-03**
4. WHEN filtros de número/status/período e paginação são usados THEN the frontend SHALL enviar a query do contrato e apresentar OrderSummaryResponse e meta, reiniciando em page 1 quando os filtros mudam. **WEB-04**
5. WHEN um pedido é criado por formulário válido THEN the frontend SHALL enviar CreateOrderRequest e abrir seu detalhe após 201, sem converter centavos por ponto flutuante. **WEB-05**
6. WHEN um pedido é aberto THEN the frontend SHALL exibir seus campos públicos, itens, total BRL e data civil sem deslocamento de fuso. **WEB-06**
7. WHEN edição válida é confirmada THEN the frontend SHALL enviar PATCH somente dos campos alterados, enviando objetos completos e coleção completa quando alterados, e recarregar o detalhe confirmado pela API. **WEB-07**
8. WHEN exclusão é confirmada em diálogo THEN the frontend SHALL executar DELETE e atualizar a lista após 204; cancelar o diálogo não envia DELETE. **WEB-08**
9. WHEN telas carregam, não têm resultados ou recebem erro THEN the frontend SHALL apresentar respectivamente indicador de carregamento, mensagem de vazio ou erro seguro com ação de tentar novamente, sem simular sucesso. **WEB-09**
10. The frontend SHALL oferecer labels associados aos campos, foco por teclado e botões de submissão desabilitados durante a requisição, permitindo fluxo completo em 390 px e 1280 px de largura. **WEB-10**

**Independent Test:** testes de componente para estados e payloads, integração web com transporte controlado e Playwright contra a stack real para o fluxo vertical. Mock de fetch no teste de componente não substitui browser/HTTP de verdade.

### S11: Manter o monorepo e subir a stack em containers (obrigatório na revisão)

Como desenvolvedor/avaliador, quero comandos únicos na raiz e execução containerizada sem perder a API já construída.

**Acceptance Criteria**
1. WHEN a instalação é executada na raiz com lockfile congelado THEN the monorepo SHALL resolver apps/api e apps/web via pnpm workspaces e um único pnpm-lock.yaml. **MONO-01**
2. WHEN build, typecheck, testes unitários ou dev são chamados na raiz THEN the project SHALL orquestrar os apps pelo Turborepo, com dev persistente sem cache. **MONO-02**
3. WHEN migrations, seed, integração ou testes E2E são chamados THEN the task graph SHALL executá-los de verdade, com cache Turbo desabilitado para essas tarefas de estado/infraestrutura. **MONO-03**
4. WHEN as imagens de API e web são construídas THEN the Dockerfiles SHALL usar estágios de build/runtime separados, lockfile congelado, .dockerignore sem segredos e processos de runtime não-root. **PACK-01**
5. WHEN o roteiro Compose é executado em projeto de prova vazio THEN the stack SHALL disponibilizar postgres, redis, api e web com healthchecks e migrations deploy concluídas antes de aceitar tráfego da API. **PACK-02**
6. WHEN uma rota visual é recarregada no servidor web de produção THEN the web server SHALL servir a SPA e encaminhar /api para a API sem reescrever respostas de erro HTTP como index.html. **PACK-03**
7. WHEN a stack é encerrada e reiniciada sem remover volumes THEN the PostgreSQL SHALL preservar os pedidos; Redis SHALL poder perder todo o cache sem alterar dados ou impedir a API. **PACK-04**

**Independent Test:** instalar na raiz, executar grafo Turbo e conferir tarefas sem cache; construir imagens; iniciar Compose em projeto/volumes exclusivos, verificar UID, servir assets e fazer login/CRUD pelo web proxy; down/up sem remover dados.

## Frontend: limite e comportamento

- Telas: `/login`, `/orders`, `/orders/new`, `/orders/:id` e `/orders/:id/edit`; logout visível quando autenticado. Abrir `/` no host web leva a login ou lista conforme sessão. Isso não altera o `GET /` do host da API.
- Lista com número, status, cliente, previsão e criação; filtros do contrato, limpar filtros e navegação anterior/próxima respeitando meta. Falta de dados não é erro. Após excluir o último item de uma página posterior, voltar à página anterior se necessário.
- Formulário: customer e endereço completos, status, previsão e editor de 1..50 itens. Preço digitado com label de centavos, descrição e remoção/adição de itens; sem quantity. Mensagens 400 aparecem junto aos campos; 409 aparece no número do pedido.
- Detalhe mostra total e itens; campos de data civil são tratados como texto de data, não convertidos via timezone local. Não mostrar metadata interna do cache.
- Mutações não são otimistas: aguardar sucesso antes de mostrar dados salvos. Prevenir duplo clique enquanto pending; falha mantém formulário e permite nova tentativa. Não repetir POST automaticamente após falha de rede.
- Visual funcional pt-BR com shadcn/ui e Tailwind necessário à biblioteca; sem construção de biblioteca compartilhada de componentes só por existir monorepo. Nenhum segredo `JWT_SECRET`, senha do seed, DATABASE_URL ou REDIS_URL entra no bundle web.
- Desenvolvimento usa proxy Vite para `/api`; container web serve arquivos estáticos e faz proxy `/api` no mesmo host. Configuração pública opcional `VITE_API_BASE_URL`; nenhum segredo VITE_.

## Cache: limite e consistência

Cache-aside manual com cliente Redis Node compatível, sem cache HTTP global, sem cache local adicional e sem Redis como armazenamento principal. `REDIS_URL` é configuração privada obrigatória; indisponibilidade de rede do Redis não bloqueia startup. `CACHE_TTL_SECONDS` padrão 60 e `CACHE_TIMEOUT_MS` padrão 200 são inteiros positivos; timeout permitido 1..5000 ms. O deadline vale para conexão/comando usado pela requisição; cliente desconectado não enfileira operações indefinidamente.

Antes de usar payload cacheado, consultar apenas existência ativa/revisão do pedido no PostgreSQL. Miss carrega detalhe com a revisão do mesmo estado persistido. Hit válido evita carregar itens, mas não promete zero consultas SQL. PATCH/DELETE incrementam cacheRevision na transação e executam DEL após commit. Se uma leitura antiga gravar cache após DEL, a próxima consulta detecta revisão incompatível; se DEL falhar, a mesma checagem protege os dados. Requisição iniciada antes de uma mutação pode observar seu snapshot anterior; uma iniciada após resposta de sucesso não pode retornar esse snapshot. TTL limita ocupação e não substitui consistência.

Entrada inválida é tratada como miss; cache indisponível ou banco indisponível nunca autoriza servir um pedido cuja atividade/revisão não possa ser confirmada. Banco indisponível segue os erros normais da API. Health continua verificando PostgreSQL; Redis degradado é observado pelos contadores/logs seguros, sem mudar seu corpo de sucesso. Não adicionar endpoint de métricas só para o teste: contadores podem ser inspecionados pelo provider e por logs agregados. Redis na stack local não publica porta externa por padrão e não persiste cache em disco.

## Cenários de testes unitários e de componentes

Todos os cenários abaixo são planejados, não executados. Cada linha identifica o estímulo e o resultado esperado. Unitários de API usam Jest e doubles de repository/Redis/JWT; não requerem Docker. Web usa Vitest/Testing Library e transporte controlado. Testes de contrato OpenAPI não são substituídos por testes que apenas verificam chamadas de mocks.

| Cenário | Estímulo e resultado esperado | Requisitos |
| --- | --- | --- |
| U01: config válida/inválida | Validar URL, porta, issuer/audience, segredo >=32, TTL JWT/cache/timeout; inválido falha sem imprimir sentinelas | BOOT-03, AUTH-01, CACHE-04 |
| U02: ciclo de vida | Provider conecta uma instância e desconecta Prisma/Redis no shutdown, inclusive limpeza após erro de inicialização | BOOT-04, CACHE-08 |
| U03: login válido | Repository retorna usuário; verificação segura aceita senha; emissão usa claims mínimos e TTL configurado | AUTH-01, AUTH-02, AUTH-08 |
| U04: login inválido | Email ausente e senha errada geram o mesmo 401/code/detail; senha não é normalizada por trim | AUTH-03 |
| U05: guard privado | Token ausente/inválido/expirado/issuer/audience errados são rejeitados; Bearer válido injeta principal mínimo | AUTH-04, AUTH-06 |
| U06: metadata pública | @Public grava metadata e só ela permite bypass; nenhuma rota privada herda bypass indevidamente | AUTH-05, AUTH-06 |
| U07: decorator condicional | Se @CurrentUser for criado: extração HTTP válida, principal ausente e contexto inválido; caso contrário N/A documentado | AUTH-06 |
| U08: texto e objetos estritos | Trim, limites de cada string, uppercase UF; desconhecidos/nested/null/tipos incorretos e quantity rejeitados | VAL-01..03 |
| U09: datas civis | Aceitar ano bissexto válido e data passada; rejeitar 2026-02-30, timestamp e formato não exato | VAL-05, VAL-06 |
| U10: itens e centavos | 1/50 itens e 0/2000000000 aceitos; 0/51 itens, -1, 1.5 e 2000000001 rejeitados | VAL-01, VAL-04 |
| U11: query | Defaults 1/20, pageSize 1/100; rejeitar 0/101, vazio/fracionário, arrays, status inválido e filtros desconhecidos | LIST-01, VAL-01, VAL-02 |
| U12: período UTC | Converter filtro de um dia em >= início e < próximo dia; rejeitar from > to sem usar 23:59:59.999 como limite | LIST-03, VAL-04 |
| U13: PATCH schema | Rejeitar {}; customer/endereço incompletos; distinguir items omitido de [] e coleção válida | VAL-04, ORDER-05..07 |
| U14: criação no service | Pedido válido aplica PENDING quando omitido e chama caso de uso atômico sem lógica HTTP | ORDER-01, ORDER-02 |
| U15: detalhe/not found | Repository ativo retorna projeção; inexistente ou excluído produz ORDER_NOT_FOUND | ORDER-03, ORDER-10 |
| U16: PATCH no service | Campo omitido permanece; objeto enviado substitui; itens omitidos não acionam substituição; qualquer status válido aceito | ORDER-05..08 |
| U17: exclusão no service | count 1 confirma exclusão; count 0 produz 404; não executar remoção física | ORDER-09, ORDER-10 |
| U18: seleção de lista | where contém deletedAt null e todos os filtros; count usa mesmo where; select não inclui itens; skip/take e sort corretos | LIST-02, LIST-04..07 |
| U19: presenter | DATE igual em UTC/Sao_Paulo; instantes terminam Z; itens 4990+0 somam 4990 e 50 máximos somam 100000000000 | ORDER-03, ORDER-04, ORDER-14, ORDER-15 |
| U20: projeção segura | Excluir hash, deletedAt, cacheRevision e principal; resumo não contém itens/endereço/total/updatedAt | ORDER-03, LIST-06 |
| U21: mapper Prisma | P2002 orderNumber vira 409; unique de email e outras falhas não viram conflito de pedido | ERR-03, ERR-04 |
| U22: filtro HTTP | Matriz de códigos/content-type, errors por campo, HttpException preservada, 500 seguro e requestId consistente | ERR-01, ERR-02, ERR-05, ERR-07, ERR-08 |
| U23: logs | Falha contendo sentinelas não vaza senha, Authorization, documento, SQL ou payload; mantém requestId/método/rota | ERR-06 |
| U24: cache miss/hit | Miss lê detalhe e SET com TTL 60; hit da revisão atual não carrega itens e entrega o mesmo DTO | CACHE-01, CACHE-02, CACHE-07 |
| U25: cache degradado | GET/SET/DEL rejeita, timeout ou JSON inválido aciona fallback; sem fila infinita nem propagação do erro Redis | CACHE-04 |
| U26: invalidação | DEL só após commit bem-sucedido de PATCH/DELETE; rollback não invalida como se houvesse mudança | CACHE-03, ORDER-12 |
| U27: cache antigo | Revisão incompatível ou pedido excluído impede servir entrada velha; 404/erros/lista não são armazenados | CACHE-05, CACHE-06 |
| U28: contadores cache | Hit/miss/error atualizam contadores sem registrar DTO/PII | CACHE-08 |
| U29: OpenAPI | Schemas distintos, required/optional/limites/security/responses corretos e export idêntico repetido | DOC-01..05 |
| U30: sessão web | Login guarda token em memória, Authorization correto; logout/reload/401 limpam sessão e não usam storage | WEB-02, WEB-03 |
| U31: filtro/paginação web | Campos geram query correta, vazios são omitidos, novo filtro reseta page 1 e meta limita navegação | WEB-04 |
| U32: formulário web | Produzir centavos inteiros e objetos completos; PATCH só alterados; remover último item é inválido | WEB-05, WEB-07, VAL-04 |
| U33: feedback web | Loading/vazio/400 por campo/409 no número/erro de rede; falha preserva dados e não mostra sucesso | WEB-09 |
| U34: ações web | Duplo clique pending não duplica chamada; cancelar exclusão não chama DELETE; confirmar espera 204 | WEB-08, WEB-10 |
| U35: apresentação web | 4990 exibe R$ 49,90; DATE não muda com fuso; labels/foco e controles têm nomes acessíveis | WEB-06, WEB-10 |

## Cenários de integração HTTP, PostgreSQL e Redis reais

Um PostgreSQL e um Redis descartáveis por suite/processo, não por caso; migrations reais antes dos testes. Limpar tabelas e somente o namespace Redis exclusivo do teste antes de cada caso. Nunca FLUSHALL em instância externa ou volume da pessoa. App/Prisma/Redis/container encerram na finalização, inclusive após falha parcial. Relógio/fixtures controlados para datas; barreiras para concorrência; polling limitado para TTL, não sleeps arbitrários como prova.

| Cenário | Operação real e resultado esperado | Requisitos |
| --- | --- | --- |
| I01: banco vazio | migrate deploy cria tabelas, enum, DATE/JSONB/INTEGER, unique e FK esperados | BOOT-02 |
| I02: seed repetido | Duas execuções: um usuário, >=12 pedidos/1..3 itens, todos os status representados e >=3 dias distintos de criação, sem duplicação | OPS-02 |
| I03: preservação seed | Pedido externo e seed soft-deleted continuam intactos; senha de seed alterada passa a autenticar após nova execução | OPS-02, OPS-03, AUTH-08 |
| I04: login | Credenciais corretas ->200/claims/TTL; senha errada e email ausente ->401 iguais; entrada inválida ->400 | AUTH-01..03, VAL-01 |
| I05: Bearer | Cada rota de pedidos sem token ->401; tokens inválido/expirado/issuer/audience errados ->401; válido autoriza | AUTH-04, AUTH-06 |
| I06: rotas públicas | Login e health sem token são processados; GET / exige token; usuário válido adicional acessa os mesmos pedidos | AUTH-05..07 |
| I07: criação | POST exemplo ->201/Location; registro e itens existem; default PENDING e UUIDs válidos | ORDER-01, ORDER-02 |
| I08: detalhe | GET retorna campos exatos, total 4990 e datas UTC/civis; máximo total 100000000000 | ORDER-03, ORDER-04, ORDER-14, ORDER-15 |
| I09: PATCH parcial | Alterar apenas status mantém customer/endereço/itens/IDs; SHIPPED -> PENDING também é permitido | ORDER-05, ORDER-08 |
| I10: PATCH itens/objetos | Coleção antiga é substituída sem órfãos; novo endereço sem complement remove o anterior; demais campos preservados | ORDER-06, ORDER-07 |
| I11: rollback criação | Falha de persistência induzida no write de itens reverte pedido e itens, sem número parcialmente reservado | ORDER-12 |
| I12: rollback PATCH | Falha induzida após iniciar substituição reverte campos/itens/revisão; validar estado por nova conexão | ORDER-12, CACHE-03 |
| I13: exclusão | DELETE ->204 zero corpo; Order/itens persistem com deletedAt; GET/PATCH/DELETE seguintes ->404 e lista omite | ORDER-09, ORDER-10, LIST-02 |
| I14: unique | Duplicata POST e PATCH ->409; após soft delete continua 409; disputa de dois pedidos tem só um vencedor | ORDER-11, ERR-03 |
| I15: concorrência delete | Coordenar PATCH/DELETE; DELETE vencedor impede alteração posterior e nenhum cenário ressuscita registro | ORDER-13 |
| I16: filtro exato | Número trimmed, case-sensitive e não parcial; status isolado e combinado por AND | LIST-02, LIST-07 |
| I17: período | Antes do início excluído, início incluído, fim do dia incluído, próximo dia excluído; from/to isolados e iguais | LIST-03 |
| I18: paginação | Defaults e custom, empate createdAt resolvido por id DESC; total com mesmo filtro; vazio/página além do fim | LIST-01, LIST-04, LIST-05 |
| I19: inválidos HTTP | Datas impossíveis, PATCH vazio, campos desconhecidos/nested, quantity, null, UUID inválido, pageSize 101, intervalo invertido ->400/errors | VAL-01..04, VAL-06 |
| I20: válidos de borda | Data passada, documento genérico, itens de preço 0 e limites máximos, trim/UF uppercase aceitos | VAL-01, VAL-03, VAL-05 |
| I21: contrato de erros | 400/401/404/409/500 com problem+json e requestId; JSON malformado ->400; sem stack/SQL/sentinelas em resposta/log | ERR-01..08 |
| I22: health/falha banco | Banco acessível ->200 exato; interromper apenas banco efêmero após startup ->503 no health; falha inesperada de pedidos ->500 seguro | BOOT-05, BOOT-06, ERR-05 |
| I23: miss/hit Redis | Primeiro GET preenche chave/TTL; segundo GET usa payload da revisão atual sem relação de itens; respostas iguais | CACHE-01, CACHE-02, CACHE-07 |
| I24: expiração Redis | TTL curto configurado para teste expira; novo GET faz miss e repopula corretamente | CACHE-01, CACHE-07 |
| I25: invalidação PATCH | Aquecer cache, PATCH campos/itens, observar DEL e próximo GET com novos dados/revisão | CACHE-03, CACHE-05 |
| I26: invalidação DELETE | Aquecer cache, DELETE, próximo GET ->404; número continua reservado; não cachear 404 | CACHE-03, CACHE-05, CACHE-06 |
| I27: Redis indisponível | Parar Redis de prova; login/CRUD/health continuam pelo PostgreSQL; budget do cache é limitado; reconexão não trava request | CACHE-04 |
| I28: falha de DEL/recuperação | Cache aquecido, indisponibilidade Redis durante PATCH/DELETE, recuperar Redis com entrada antiga: novo GET não serve dados velhos | CACHE-04, CACHE-05 |
| I29: repopulação concorrente | Pausar GET antigo antes de SET, concluir PATCH/DELETE, liberar SET antigo; nova leitura responde atual/404 | CACHE-05 |
| I30: payload/escopo | Corromper entrada de teste ->fallback seguro; lista/login/erros não criam chaves de cache; verificar contadores | CACHE-04, CACHE-06, CACHE-08 |
| I31: OpenAPI HTTP | /docs-json real contém contratos e exemplos; login/health sem Bearer, pedidos com Bearer, 204 sem corpo; export determinístico | DOC-01..05 |
| I32: recursos/isolamento | Casos não herdam dados/cache; setup parcial libera recursos e restaura env; Docker inacessível falha sem fallback | QA-01..04, QA-08 |

Falhas de write e de invalidação podem ser induzidas por instrumentação de teste na fronteira, mas as transações, conexões e leituras de comprovação usam os bancos reais. Não chamar um teste de mock de repository de prova de rollback PostgreSQL.

## Cenários E2E de navegador e empacotamento

| Cenário | Fluxo e resultado esperado | Requisitos |
| --- | --- | --- |
| E01: fluxo completo | Browser real: login seed -> criar pedido com dois itens -> localizar por filtros -> abrir detalhe -> editar status/itens -> excluir -> lista sem pedido e detalhe 404 | QA-09, WEB-02, WEB-04..08 |
| E02: autenticação web | Login errado mostra erro; logout e reload exigem novo login; token expirado leva a login sem vazar token em URL/storage | WEB-02, WEB-03 |
| E03: estados e validação | Lista vazia, erro de API e nova tentativa, 400 por campo, 409 no número, cancelamento de exclusão e clique repetido sem duplicação | WEB-08..10 |
| E04: web acessível | Em 390/1280 px, operar login e formulário por teclado, verificar foco/labels e ler itens/total sem controles inacessíveis | WEB-10 |
| E05: monorepo | Install frozen na raiz; Turbo executa apps; migrations/seed/integração/E2E sempre executam, nunca cache hit substituindo prova | MONO-01..03 |
| E06: imagens | Build API/web; runtime não-root, sem .env/segredos/build tools desnecessários; API compiled e web estático servem corretamente | PACK-01 |
| E07: stack Compose | Projeto descartável: banco/Redis -> migrations deploy -> API/web; health OK, proxy /api funciona, reload em /orders/:id serve SPA | PACK-02, PACK-03 |
| E08: persistência/degradação | Criar pedido, down/up mantendo volume, pedido permanece; limpar/perder apenas Redis não altera pedido e permite repopular cache | PACK-04 |

## Mapa de provas e gates

- API unitária/contrato: U01..U29; web unitária/componentes: U30..U35. Unitários nunca dependem de Docker.
- HTTP/PostgreSQL/Redis: I01..I32. Playwright web real: E01..E04. Roteiro monorepo/containers: E05..E08.
- Coverage original continua >=80% lines e >=70% branches nas áreas de negócio/validação/DTO/guard/erros; incluir lógica de cache e lógica própria de sessão/formulários web. Excluir código gerado de Prisma e código vendor de componentes shadcn apenas com justificativa, sem excluir fluxos próprios.
- Cada caso parametrizado deve apontar para seu ID e para o requisito correspondente. Uma chamada observada em mock não comprova valor persistido, rollback ou resposta ao consumidor.
- Gate final: instalar com lockfile, lint, format:check, typecheck, build dos dois apps, unitários/contrato, cobertura, integração real, E2E web e smoke Docker/Compose. Relatar comando, exit code e resultado observado. Qualquer indisponibilidade bloqueia a prova respectiva; nunca resulta em PASS inferido.

## Entrega reproduzível

### Etapas, branches e commits

- `tasks.md` identificará a branch de cada etapa/fase e sua branch-base. Uma etapa pode conter várias tarefas atômicas; não criar uma branch por arquivo ou por commit.
- A primeira etapa começa em `feat/postgres-testcontainers`, conforme autorização explícita. Não renomear nem descartar essa branch ou seus commits existentes.
- Cada etapa seguinte usa uma nova branch local a partir do último commit validado da etapa anterior. As branches são encadeadas para carregar suas dependências; não são implementações independentes partindo todas de main.
- Encerrar uma etapa somente após os gates das suas tarefas. Preservar sua branch e registrar o commit de término e a próxima branch-base antes de avançar.
- Cada tarefa concluída gera um commit Conventional Commits com um único propósito, incluindo código, testes, documentação relevante, conclusão em tasks.md e atualização de rastreabilidade. Não acumular tarefas em um único commit de etapa.
- O plano de tarefas incluirá o versionamento seletivo dos artefatos necessários: `.specs/` está ignorado atualmente. Não adicionar indiscriminadamente os planos históricos nem mudar essa política silenciosamente.
- O usuário fará os merges. Não executar merge, squash, rebase do histórico existente, push, exclusão de branches ou deploy como parte deste fluxo sem nova autorização explícita.

### Configuração

Validar `NODE_ENV` (development/test/production), `PORT` (inteiro 1..65535), `DATABASE_URL` PostgreSQL, `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_EXPIRES_IN`, `REDIS_URL` (redis/rediss), `CACHE_TTL_SECONDS`, `CACHE_TIMEOUT_MS` e `CORS_ORIGIN` quando presente. Issuer/audience são strings não vazias. `SEED_USER_EMAIL` e `SEED_USER_PASSWORD` são obrigatórios no comando de seed, não no runtime da API que não executa seed. A validação do seed não aceita senha vazia. `.env.example` contém placeholders e instruções para criar segredo forte, nunca segredo funcional silencioso.

Aplicar CORS configurável e helmet compatível. As versões efetivas e eventuais desvios do bootstrap serão registrados após verificação em documentação oficial e gates de geração/build/runtime. Não misturar receitas Prisma 6 e 7.

### Scripts

Manter aliases existentes quando úteis. Os nomes públicos finais podem seguir convenções atuais, desde que README mapeie claramente cada função:

| Script solicitado | Efeito verificável |
| --- | --- |
| dev, start, start:prod | Desenvolvimento e execução da API compilada, com diferença documentada |
| build | Gerar client necessário e compilar TypeScript de produção |
| db:generate | Gerar Prisma Client |
| db:migrate:dev | Criar/aplicar migrations no desenvolvimento, nunca na produção |
| db:migrate:deploy | Aplicar migrations versionadas sem gerar migrations novas |
| db:seed | Executar seed independente e idempotente |
| docs:openapi | Exportar OpenAPI determinístico; se versionado, verificar atualização |
| lint, format, format:check | Biome: lint e formatação separados, sem autofix destrutivo como gate |
| typecheck | Verificar tipos sem emissão |
| test:unit | Unitários sem PostgreSQL ou Docker |
| test:integration | HTTP real e PostgreSQL Testcontainers |
| test:e2e:web | Playwright com frontend, API e bancos reais em ambiente isolado |
| test:containers | Smoke das imagens/Compose, em projeto e volumes de prova próprios |
| test:coverage | Aplicar thresholds às áreas explicitadas em QA-05 |
| check | Executar todos os gates de QA-06 e propagar falhas; não cachear provas de infraestrutura |

Biome usa LF, aspas simples TS, indentação de dois espaços, largura próxima de 100, formatter/linter/assist e suporte a parameter decorators quando exigido pela versão. Não excluir src/testes; excluir dependências, gerados, build e coverage. Não aplicar import-type autofix sem considerar metadata de DI. TypeScript strict; sem any injustificado, non-null arbitrário ou ts-ignore sem justificativa.

### Documentação final

README em português: objetivo; stack e razões; pré-requisitos; instalação com lockfile; preparação de env/segredo; Compose; migrations; seed; execução dev/produção; login e geração de token; curls de CRUD e filtros; scripts; docs; testes e Docker; estrutura do monorepo e tarefas Turbo; centavos BRL; data civil versus instantes UTC; PATCH integral dos objetos/itens; soft delete e reserva de número; matriz de erros; limitações verificadas e próximos passos honestos. Incluir como abrir o frontend, credenciais demonstrativas por env, diferenças entre token em memória e reload, build estático, proxy /api, cache hit/miss/TTL/invalidação, perda de Redis e comando de seed explícito após migrations. Publicar portas locais configuráveis; não expor Redis por padrão.

`docs/decisions.md`: monólito modular enxuto; PostgreSQL; JSONB de endereço sem identidade; relação 1:N de itens; preços em centavos; Zod; DTOs de saída sem SQL; queries/projeções; filtros UTC; trade-offs de concorrência; compatibilidade ESM/Prisma. Registrar a mudança explícita do handoff para cache-aside por solicitação do usuário, TTL, chave versionada, revisão persistida, invalidação pós-commit e fail-open. Explicar que o hit ainda consulta uma projeção pequena no banco para preservar consistência e que não há alegação de ganho de performance sem medição. Não cachear listas. Registrar React/Vite sem SSR, shadcn/ui, token em memória, Turborepo enxuto e containerização local, sem deploy inferido.

Controllers cuidam de HTTP/DTO; services de casos de uso; repository concreto centraliza queries Prisma sem interface abstrata genérica. Factories de saída podem converter DATE, UTC, JSONB e total sem acessar banco. Parse de entrada ocorre uma vez na borda. Reaproveitar a base útil e não acrescentar camadas cerimoniais.

## Edge Cases

| Caso de prova | Resultado esperado | Requisitos |
| --- | --- | --- |
| Mesmo número após DELETE | POST/PATCH conflitando retornam 409; número não liberado | ORDER-11, ERR-03 |
| Segunda exclusão, leitura ou edição pós-delete | 404 ORDER_NOT_FOUND; itens persistidos | ORDER-09, ORDER-10 |
| PATCH com itens omitidos versus presentes | IDs preservados versus coleção inteiramente substituída | ORDER-05, ORDER-06 |
| PATCH com complement omitido no endereço novo | Endereço substituído não retém complement anterior | ORDER-07 |
| Falha no meio da substituição | Pedido e itens permanecem no estado anterior | ORDER-12 |
| DELETE vence a disputa com PATCH | Nenhuma edição posterior efetivada, nem ressurreição | ORDER-13 |
| 2026-10-20T23:59:59.999Z e 2026-10-22T00:00:00Z em filtro do dia 21 | Ambos excluídos; início e último instante do dia 21 incluídos | LIST-03 |
| Filtros iguais com empate de timestamp | Mesma ordem id DESC, total consistente com where | LIST-04, LIST-05 |
| Página além da última e total zero | data vazio; meta solicitada; totalPages ceil(total/pageSize) | LIST-05 |
| Total maior que INTEGER PostgreSQL | Soma pública 100000000000, sem persistir total em INTEGER | ORDER-15 |
| Seed repetido com pedido externo sentinela | Nenhuma duplicação e sentinela intacta | OPS-02, OPS-03 |
| Exceção com SQL/senha/documento sentinela | 500 genérico e logs sem sentinelas | ERR-05, ERR-06 |
| Cache repopulado por GET antigo após DEL | Nova leitura descarta revisão incompatível; nunca exibe soft-deleted | CACHE-05 |
| Redis fora durante write e depois recuperado | Write permanece válido e próxima leitura vê revisão nova/404 | CACHE-04, CACHE-05 |
| Login visual seguido de refresh de página | Sessão em memória perdida; retornar a login | WEB-02, WEB-03 |
| Navegação direta em /orders/:id no host web | Arquivo SPA servido; sem sessão, login; /api conserva semântica HTTP | PACK-03, WEB-03 |

## Cobertura das dimensões implícitas

| Dimensão | Resolução dentro do escopo |
| --- | --- |
| Validação e limites | Contrato de entrada/query e VAL-01..06; env BOOT-03; saída pública ORDER-03. |
| Falha e falha parcial | Rollback ORDER-12; health BOOT-06; limpeza QA-03; erros ERR-01..08; fallback Redis CACHE-04; feedback web WEB-09. |
| Idempotência, retry e duplicatas | Unicidade ORDER-11/ERR-03, segunda exclusão ORDER-10, seed OPS-02/03. N/A para nova chave Idempotency-Key ou retries de POST: não pedidos. |
| Autorização e limites de acesso | AUTH-01..08; todos autenticados veem pedidos. Throttling adiado como P1; nenhuma garantia P0 de rate limit. |
| Concorrência e ordem | ORDER-11..13, LIST-04 e CACHE-05; PATCH sem versão pública/ETag; cacheRevision é interna; sem garantia de snapshot conjunto entre count e findMany, conforme handoff. |
| Ciclo de dados e expiração | Soft delete ORDER-09/10; número reservado; expiração JWT AUTH-01/04; TTL de Redis CACHE-01/07; sessão web em memória WEB-02/03; sem purga física ou refresh token. |
| Observabilidade | ERR-06/07, health e contadores CACHE-08; N/A para plataforma de tracing distribuído: não solicitada. |
| Falha de dependência externa | PostgreSQL: BOOT-06/ERR-05; Docker QA-04; Redis fail-open CACHE-04; erro de rede na UI WEB-09. Circuit breaker e serviços adicionais não entram no escopo. |
| Integridade de transições | ORDER-08 permite qualquer status válido; ORDER-09/13 impedem ressurreição. N/A para máquina adicional de status, explicitamente excluída. |

## Requirement Traceability

Cada ID identifica o critério EARS correspondente. Tarefas e evidências só serão preenchidas nas etapas posteriores; nenhum item abaixo está implementado ou verificado por esta spec.

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BOOT-01 | S1: stack e build | Specify | Pending |
| BOOT-02 | S1: migrations/modelos | Specify | Pending |
| BOOT-03 | S1: ambiente validado | Specify | Pending |
| BOOT-04 | S1: lifecycle Prisma | Specify | Pending |
| BOOT-05 | S1: health disponível | Specify | Pending |
| BOOT-06 | S1: health indisponível | Specify | Pending |
| AUTH-01 | S2: login válido | Specify | Pending |
| AUTH-02 | S2: claims mínimos | Specify | Pending |
| AUTH-03 | S2: credenciais inválidas | Specify | Pending |
| AUTH-04 | S2: validação Bearer | Specify | Pending |
| AUTH-05 | S2: metadata pública | Specify | Pending |
| AUTH-06 | S2: proteção por padrão | Specify | Pending |
| AUTH-07 | S2: acesso compartilhado | Specify | Pending |
| AUTH-08 | S2: hash seguro | Specify | Pending |
| ORDER-01 | S3: criação | Specify | Pending |
| ORDER-02 | S3: status inicial | Specify | Pending |
| ORDER-03 | S3: detalhe e DTO | Specify | Pending |
| ORDER-04 | S3: total | Specify | Pending |
| ORDER-05 | S3: preservação dos itens | Specify | Pending |
| ORDER-06 | S3: substituição dos itens | Specify | Pending |
| ORDER-07 | S3: substituição dos objetos | Specify | Pending |
| ORDER-08 | S3: status sem máquina | Specify | Pending |
| ORDER-09 | S3: soft delete | Specify | Pending |
| ORDER-10 | S3: inexistente/excluído | Specify | Pending |
| ORDER-11 | S3: unicidade concorrente | Specify | Pending |
| ORDER-12 | S3: rollback | Specify | Pending |
| ORDER-13 | S3: corrida PATCH/DELETE | Specify | Pending |
| ORDER-14 | S3: data civil | Specify | Pending |
| ORDER-15 | S3: soma máxima | Specify | Pending |
| LIST-01 | S4: defaults | Specify | Pending |
| LIST-02 | S4: filtros combinados | Specify | Pending |
| LIST-03 | S4: limites UTC | Specify | Pending |
| LIST-04 | S4: ordem determinística | Specify | Pending |
| LIST-05 | S4: metadados | Specify | Pending |
| LIST-06 | S4: projeção enxuta | Specify | Pending |
| LIST-07 | S4: igualdade exata | Specify | Pending |
| VAL-01 | S5: limites/tipos | Specify | Pending |
| VAL-02 | S5: objetos estritos | Specify | Pending |
| VAL-03 | S5: normalização | Specify | Pending |
| VAL-04 | S5: PATCH/intervalos inválidos | Specify | Pending |
| VAL-05 | S5: ausência de regras inventadas | Specify | Pending |
| VAL-06 | S5: datas inválidas | Specify | Pending |
| ERR-01 | S6: matriz/envelope | Specify | Pending |
| ERR-02 | S6: erros por campo | Specify | Pending |
| ERR-03 | S6: conflito orderNumber | Specify | Pending |
| ERR-04 | S6: não mascarar Prisma | Specify | Pending |
| ERR-05 | S6: falha inesperada | Specify | Pending |
| ERR-06 | S6: logs seguros | Specify | Pending |
| ERR-07 | S6: correlação | Specify | Pending |
| ERR-08 | S6: exceções HTTP nativas | Specify | Pending |
| DOC-01 | S7: superfícies OpenAPI | Specify | Pending |
| DOC-02 | S7: schemas separados | Specify | Pending |
| DOC-03 | S7: contrato derivado | Specify | Pending |
| DOC-04 | S7: responses documentados | Specify | Pending |
| DOC-05 | S7: export determinístico | Specify | Pending |
| DOC-06 | S7: README/decisões | Specify | Pending |
| OPS-01 | S8: Compose local | Specify | Pending |
| OPS-02 | S8: seed idempotente | Specify | Pending |
| OPS-03 | S8: preservar dados externos | Specify | Pending |
| OPS-04 | S8: seed/segredos seguros | Specify | Pending |
| OPS-05 | S8: scripts | Specify | Pending |
| QA-01 | S8: integração real | Specify | Pending |
| QA-02 | S8: isolamento | Specify | Pending |
| QA-03 | S8: teardown seguro | Specify | Pending |
| QA-04 | S8: Docker indisponível | Specify | Pending |
| QA-05 | S8: cobertura | Specify | Pending |
| QA-06 | S8: gates | Specify | Pending |
| QA-07 | S8: verificação independente | Specify | Pending |
| QA-08 | S8: integração Redis real | Specify | Pending |
| QA-09 | S8: E2E web real | Specify | Pending |
| CACHE-01 | S9: miss e TTL | Specify | Pending |
| CACHE-02 | S9: hit válido | Specify | Pending |
| CACHE-03 | S9: invalidação pós-commit | Specify | Pending |
| CACHE-04 | S9: fail-open e timeout | Specify | Pending |
| CACHE-05 | S9: consistência concorrente | Specify | Pending |
| CACHE-06 | S9: escopo do cache | Specify | Pending |
| CACHE-07 | S9: chave versionada | Specify | Pending |
| CACHE-08 | S9: contadores/lifecycle | Specify | Pending |
| WEB-01 | S10: stack SPA | Specify | Pending |
| WEB-02 | S10: login em memória | Specify | Pending |
| WEB-03 | S10: expiração/ausência de sessão | Specify | Pending |
| WEB-04 | S10: filtros/paginação | Specify | Pending |
| WEB-05 | S10: criação por formulário | Specify | Pending |
| WEB-06 | S10: detalhe e apresentação | Specify | Pending |
| WEB-07 | S10: edição por formulário | Specify | Pending |
| WEB-08 | S10: confirmação de exclusão | Specify | Pending |
| WEB-09 | S10: estados de feedback | Specify | Pending |
| WEB-10 | S10: acessibilidade/layout | Specify | Pending |
| MONO-01 | S11: workspace/lockfile | Specify | Pending |
| MONO-02 | S11: orquestração Turbo | Specify | Pending |
| MONO-03 | S11: tarefas sem cache | Specify | Pending |
| PACK-01 | S11: Dockerfiles seguros | Specify | Pending |
| PACK-02 | S11: Compose e prontidão | Specify | Pending |
| PACK-03 | S11: SPA/proxy | Specify | Pending |
| PACK-04 | S11: persistência/degradação | Specify | Pending |

**Coverage:** 95 requisitos alocados no rascunho de tasks.md, em 53 tarefas e nove etapas/branches; nenhum implementado/verificado por este planejamento. Cenários planejados: 35 unitários/componentes, 32 de integração e 8 E2E/empacotamento (75 grupos parametrizáveis, não promessa de apenas 75 asserts). Os testes devem derivar destes resultados esperados, não reproduzir detalhes da implementação. Aprovar os rascunhos não autoriza execução nesta rodada, por instrução posterior explícita do usuário.

## Success Criteria

- [x] Spec revisada e aprovada antes de design/tarefas/execução.
- [ ] Todos os P0 originais e os acréscimos obrigatórios da revisão rastreados até testes e evidência; bônus P1 permanecem separados.
- [ ] Instalação com lockfile, Compose, migrations, seed, login e CRUD reproduzidos em ambiente de prova.
- [ ] Biome, typecheck, builds API/web, unitários, contrato, integração PostgreSQL/Redis, cobertura, E2E browser e smoke de containers executados com sucesso para conclusão sem ressalvas.
- [ ] Verifier independente executa checagem por AC e mutações comportamentais em scratch; validation.md obtém PASS com evidência file:line.
- [ ] Limitação de ambiente é relatada como bloqueio de prova, nunca como teste aprovado; não declarar pronto com gate pendente/falhando.
- [ ] Commits locais atômicos por tarefa incluem tasks.md e traceabilidade atualizados; nenhum push/deploy/ação destrutiva inferido da aprovação.
- [ ] Cada etapa de desenvolvimento tem sua branch identificada, com primeira etapa na branch atual e etapas seguintes encadeadas; merges ficam a cargo do usuário.

## Referências técnicas consultadas

- [Nest: validação e Standard Schema](https://docs.nestjs.com/techniques/validation), via Context7 `/nestjs/docs.nestjs.com`: pipe nativo e schemas nos decorators de parâmetro.
- [Nest: OpenAPI](https://docs.nestjs.com/openapi/introduction), via Context7: conversão dos schemas de parâmetros em documentação.
- [Prisma: upgrade para v7](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7), via Context7 `/prisma/web`: configuração, generator explícito e driver adapter. A consulta retornou também exemplos históricos; não são prova de compatibilidade exata das versões instaladas.
- [Turborepo: configuração](https://turborepo.com/docs/reference/configuration), via Context7 `/vercel/turborepo`: pnpm workspaces, tasks, cache e dev persistente.
- [Vite: env](https://vite.dev/guide/env-and-mode) e [proxy](https://vite.dev/config/server-options), via Context7 `/vitejs/vite`: variáveis VITE_ são públicas; frontend estático usa proxy /api.
- [shadcn/ui: Vite](https://ui.shadcn.com/docs/installation/vite), via Context7 `/shadcn-ui/ui`: React/TypeScript, Tailwind e aliases compatíveis.
- [React: estado](https://react.dev/learn/sharing-state-between-components), via Context7 `/reactjs/react.dev`: estado controlado e reset de formulários.
- [Redis: cache-aside](https://redis.io/docs/latest/develop/use-cases/cache-aside/) e [cliente Node](https://redis.io/docs/latest/develop/clients/nodejs/), via Context7 `/redis/docs`: GET/SET com expiração e DEL; TTL sozinho permite stale e não substitui a verificação de revisão desta spec. Não confundir cache-aside com client-side caching RESP3.
- [Docker: React](https://docs.docker.com/guides/reactjs/) e [ordem de inicialização Compose](https://docs.docker.com/compose/how-tos/startup-order/), via Context7 `/docker/docs`: build/runtime separados, estáticos não-root e condições de saúde/conclusão. Exemplos Next.js retornados na consulta não autorizam SSR.

As consultas sustentam a viabilidade, não substituem os gates de versão, runtime e contrato da implementação. Esta spec não instala dependências, altera código de aplicação nem certifica o estado atual dos testes.
