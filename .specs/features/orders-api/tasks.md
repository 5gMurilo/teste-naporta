# naPorta: tarefas e gates

**Status:** aprovado na revisão conjunta via Plannotator em 2026-10-21 (`decision: approved`). Phase 1 concluída (T1–T6); execução autorizada nesta sessão para Phase 2, somente T7–T10. **T37 de 53 tarefas concluída.**
**Design:** [design.md](design.md). **Spec:** [spec.md](spec.md). **Branches:** [branches.md](branches.md).
**Autorização de execução:** o usuário autorizou Phase 2 e Phase 3 e, em 2026-10-21, autorizou seguir autonomamente pelas demais tarefas (T19–T53), criando as branches encadeadas de `branches.md` quando necessário. Continua não autorizado: merge, push, rebase, force-push, PR, remoção de volumes/dados e MCP remoto. A aprovação no Plannotator por si só não autorizava execução.

## Execution Protocol

Um commit por tarefa, somente após gate verde, incluindo testes/documentação/conclusão da tarefa e traceabilidade. Não enfraquecer/remover testes para passar. Merge, push e T11 não fazem parte da autorização desta execução.

Cada tarefa tem uma unidade principal; arquivos auxiliares de wiring, teste, docs de contrato e lockfile são permitidos somente quando necessários para tornar essa mesma unidade verificável. Não tratar esse apoio como permissão para implementar componentes de tarefas futuras. Mudanças mecânicas de relocation são isoladas de mudanças funcionais.

Ferramentas propostas por tarefa: ferramentas locais de arquivo/shell; Context7 para as bibliotecas tocadas; skills tlc-spec-driven, codenavi e coding-guidelines na implementação; commits feitos diretamente com git (Conventional Commits, escopo da tarefa, sem `git add .`). Não usar MCP remoto de Jira/Workforce nem abrir PR. Confirmar ferramentas e eventual delegação antes da execução, não nesta rodada bloqueada. Verifier independente é obrigatório ao final, sem delegar implementação sem consentimento.

## Test Coverage Matrix

> Gerada do código, das diretrizes do handoff e da spec; sujeita à revisão antes de Execute. Fontes: package.json, jest.config.cjs, test/jest-e2e.config.cjs, test/jest-integration.config.cjs, README.md seção Testes; os seis testes amostrados estão listados em design.md. A profundidade e thresholds vêm da spec, não da cobertura atual. Não há AGENTS.md/CONTRIBUTING.md no repositório inspecionado. Comandos futuros estão explicitamente diferenciados abaixo.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Planejamento/ignore | Documental e estrutural | Artefatos atuais rastreáveis seletivamente; histórico ignorado; validadores e diff sem whitespace | .specs/features/orders-api/ | D |
| Relocation/workspace/toolchain | Regressão estrutural/build | Preservar comportamento, descoberta e casos existentes; gerar e executar API compilada | apps/api e raiz | B0, depois B |
| Config/lifecycle/factory | Unit + HTTP fixture e integração quando houver conexão | Valores válidos/inválidos, sigilo, connect/disconnect e cleanup parcial | apps/api/src/**/*.spec.ts; test/integration/ | Q e F |
| Schemas/DTO/presenter | Unit + contrato | Cada limite/normalização/shape/DATE/total; todos os edges da spec | apps/api/src/orders/**/*.spec.ts; test/contract/ | Q e F em endpoint |
| Auth/guard/metadata | Unit + HTTP integrado | Credenciais e claims, todos os tokens inválidos, bypass só por metadata e proteção global real | apps/api/src/auth/**/*.spec.ts; test/integration/ | F |
| Errors/log/requestId | Unit + HTTP integrado | Cada code/status, native HTTP, Prisma específico, sentinelas de vazamento e header | apps/api/src/common/**/*.spec.ts; test/integration/ | F |
| Orders service | Unit | ACs 1:1 e todas as alternativas/erros da unidade criada | apps/api/src/orders/**/*.spec.ts | Q, dentro de F |
| Orders repository/endpoint | Unit + HTTP/PostgreSQL integrado + contrato | Endpoint happy/edge/error, SQL projetado, rollback/concorrência em banco real, OpenAPI no mesmo commit | apps/api/test/integration/; test/contract/ | F |
| Redis/cache reader | Unit + HTTP/PostgreSQL/Redis integrado | Deadline, TTL, miss/hit, codec, lifecycle, invalidação e corridas | apps/api/src/cache/**/*.spec.ts; test/integration/ | F |
| Web infra/HTTP/session/model | Unit/componentes | Todos os estados e payloads; sem storage/segredo; cancelamento e 204/401 | apps/web/src/**/*.test.{ts,tsx} | W |
| Web página/form/dialog | Componentes + browser quando fluxo estiver acessível | Happy/edge/error e teclado da unidade; teste junto da página criada, nunca só no final | apps/web/src/**/*.test.tsx; test/e2e/ | W, depois H |
| Dockerfile/runtime/proxy/Compose | Build + smoke real | Não-root, dist/assets, health/proxy, migração pré-tráfego, volumes próprios | scripts e arquivos de container | C |
| Docs finais/check | Documental + smoke do roteiro e gate completo | Export sem drift, curls/roteiro reproduzidos, falhas propagadas | README.md; docs/ | A |

Coverage API e lógica própria web: >=80% lines e >=70% branches separadamente. Configurar inclusão de arquivos não importados; excluir somente bootstrap/gerados/vendor justificados. Não impor testes artificiais de markup vendor. U07 fica N/A se @CurrentUser não existir, como prevê a spec; isso não é skip de teste existente. Todos os outros grupos U01–U35, I01–I32 e E01–E08 têm responsáveis abaixo.

## Gate Check Commands

### Comandos descobertos, que já existem

| Comando atual na raiz | Evidência | Uso |
| --- | --- | --- |
| pnpm test | package.json:14 e jest.config.cjs | Unitários Jest ESM |
| pnpm test:e2e | package.json:15 | HTTP com providers controlados, sem PostgreSQL |
| pnpm test:integration | package.json:16 | Testcontainers PostgreSQL; ainda sem schema de negócio |
| pnpm lint | package.json:17 | Biome check; não inclui política de estilo final ainda |
| pnpm build | package.json:11 | Prisma generate + tsc |
| pnpm prisma:generate / prisma:validate | package.json:19–20 | Geração/validação Prisma |

Esses comandos foram lidos, não executados nesta rodada. Não apresentar comandos planejados como se já estivessem disponíveis. A tabela abaixo define scripts/aliases a serem criados nas tarefas indicadas.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| D | T1 e validação documental | python3 com validate_spec.py e validate_tasks.py da skill ativa, ambos --strict; git diff --check; verificar ignore seletivo para feature/STATE e histórico ignorado |
| B0 | T2 antes dos aliases novos | pnpm --dir apps/api prisma:generate; pnpm --dir apps/api prisma:validate; pnpm --dir apps/api build; pnpm --dir apps/api test --runInBand; pnpm --dir apps/api test:e2e --runInBand; pnpm --dir apps/api test:integration --runInBand; pnpm lint na raiz; smoke Node compilado |
| Q | API unitária após T3 | pnpm lint; pnpm typecheck; pnpm --filter @naporta/api test:unit; teste focal da tarefa e regressões existentes |
| F | Unidade com endpoint/DB/cache | Q + pnpm --filter @naporta/api test:e2e; pnpm --filter @naporta/api test:contract; pnpm --filter @naporta/api test:integration; pnpm --filter @naporta/api build |
| B | Conclusão das etapas 1–5 | pnpm lint; pnpm format:check; pnpm typecheck; pnpm build; pnpm test:unit; pnpm --filter @naporta/api test:e2e; pnpm --filter @naporta/api test:integration; contrato e cobertura de todas as unidades já entregues |
| W | Unidade web a partir de T31 | pnpm lint; pnpm format:check; pnpm typecheck; pnpm --filter @naporta/web test:unit; pnpm --filter @naporta/web build; browser acrescentado em H a partir de T36 |
| H | Fluxo web com harness disponível | W + pnpm test:e2e:web; F para regressão da API da etapa; gates não usam cache de teste |
| C | Imagem/serviço adicionado | Build da imagem específica + pnpm test:containers com seleção da unidade; após T50 smoke da stack inteira; requisitos de script descritos em T48–T50 |
| A | Fechamento das etapas finais e entrega | pnpm check: lint + format:check + typecheck + builds + unit/contrato + coverage + integração + E2E web + containers; T51 cria agregador final, todos com exit codes propagados |

T3 cria aliases API unit/typecheck/format e cobertura, além da orquestração Turbo. T18 cria test:contract/docs:openapi. Até T18, F executa suites existentes e os testes focais de contrato sob Jest, sem invocar script inexistente; a partir de T18 o contrato separado é obrigatório. T31 cria scripts de teste/build web; T36 cria test:e2e:web; T48 cria runner test:containers com seleção de API, T49 amplia web e T50 amplia Compose; T51 fecha check. Não usar script vazio, passWithNoTests, skip ou fake service para fazer um gate parecer disponível.

Os comandos de verificação do planejamento usam o diretório descoberto da skill ativa, não scripts/ relativo ao projeto. A execução futura deve reler a skill para resolver esse diretório. Separadores acima representam comandos distintos, todos verificados individualmente, não sucesso inferido do último.

**Contagem de testes:** cada task especifica mínimo de novos casos/grupos relevantes, não um resultado já medido. Capturar o baseline real quando execução for autorizada; manter os casos anteriores e registrar número obtido/parametrizações. Um novo grupo cobre todas as linhas referenciadas da spec, mesmo que exceda o mínimo. Falha ou ausência de infraestrutura bloqueia a tarefa.

## Execution Plan

Nove etapas sequenciais, cada uma na branch de branches.md. Também há ordem estrita entre tarefas; Depends on registra a dependência operacional imediatamente anterior, com as dependências técnicas anteriores transitivas. Não há paralelismo de implementação dentro das etapas.

### Phase 1: Fundação (branch atual)
```text
T1 -> T2 -> T3 -> T4 -> T5 -> T6
```
### Phase 2: Persistência
```text
T7 -> T8 -> T9 -> T10
```
### Phase 3: Segurança e contrato
```text
T11 -> T12 -> T13 -> T14 -> T15 -> T16 -> T17 -> T18
```
### Phase 4: Pedidos
```text
T19 -> T20 -> T21 -> T22 -> T23 -> T24 -> T25
```
### Phase 5: Cache
```text
T26 -> T27 -> T28 -> T29 -> T30
```
### Phase 6: Plataforma web
```text
T31 -> T32 -> T33 -> T34 -> T35 -> T36 -> T37
```
### Phase 7: Lista e formulário
```text
T38 -> T39 -> T40 -> T41 -> T42 -> T43
```
### Phase 8: Fluxo web
```text
T44 -> T45 -> T46 -> T47
```
### Phase 9: Entrega
```text
T48 -> T49 -> T50 -> T51 -> T52 -> T53
```

Ligações entre etapas, correspondentes às bases de branches:
```text
T6 -> T7
T10 -> T11
T18 -> T19
T25 -> T26
T30 -> T31
T37 -> T38
T43 -> T44
T47 -> T48
```

## Task Breakdown

### Phase 1: Fundação

#### T1: Tornar o planejamento atual seletivamente rastreável
**What**: Ajustar política de ignore e versionar somente estado/artefatos desta feature no primeiro commit de planejamento.
**Where**: `.gitignore`
**Depends on**: None
**Reuses**: Política de ignore atual; spec/design/tasks/branches locais.
**Requirement**: MONO-01, QA-06; contrato de execução/AD-001.
**Done when**: [x] Feature e STATE podem ser adicionados sem force; planos históricos e .env continuam ignorados; todos os validadores documentais passam; nenhuma implementação misturada.
**Tests**: Documentais/estruturais, >=4 verificações de ignore/artefatos, preservando arquivos existentes.
**Gate**: D.
**Commit**: `docs(plan): track reviewed orders delivery artifacts`

#### T2: Relocar a API existente para apps/api
**What**: Uma refatoração mecânica da aplicação atual, seus testes/Prisma/configs, preservando ESM e comportamento.
**Where**: `apps/api/`
**Depends on**: T1
**Reuses**: Toda a API/testes atuais e lockfile; nome do app @naporta/api.
**Requirement**: BOOT-01, MONO-01, OPS-05.
**Done when**: [x] Instalação resolve novo path com manifest raiz privado e pnpm-workspace mínimo para apps/*, lockfile com importer da API, geração/build/runtime e todas as suites antigas passam; registrar engines/peers/Node utilizado; sem domínio/auth novo. Corrigir somente incompatibilidade comprovada indispensável à relocation. O workspace mínimo integra esta refatoração para não deixar um commit sem dependências resolvíveis; Turbo vem em T3.
**Tests**: Regressão das suites existentes + >=2 provas estruturais de imports/execução compilada; baseline medido, sem reduzir casos.
**Gate**: B0.
**Commit**: `refactor(api): move existing bootstrap into apps workspace`

#### T3: Orquestrar scripts de workspace com Turborepo
**What**: Acrescentar Turborepo ao workspace mínimo de T2 e scripts de qualidade/teste para os apps que já existirem, sem web placeholder.
**Where**: `turbo.json`
**Depends on**: T2
**Reuses**: Scripts atuais da API; pnpm 10.33.0 e lockfile único.
**Requirement**: MONO-01, MONO-02, MONO-03, OPS-05, QA-05, QA-06.
**Done when**: [x] Build/typecheck/test:unit/dev delegam à API; dev persistente; unit/coverage/estado/infra sem cache de testes; incluir arquivos elegíveis e thresholds 80/70 já nas áreas atuais; aliases e preservação da integração comprovados por E05.
**Tests**: Estruturais/workspace + regressão, >=4 casos de grafo/propagação/cache e cobertura atual, E05 parcial.
**Gate**: B; contrato separado só é introduzido em T18.
**Commit**: `build(workspace): orchestrate api tasks with turborepo`

#### T4: Fixar a política Biome do monorepo
**What**: Aplicar configuração de estilo/assist/lint solicitada, em commit isolado de formatação.
**Where**: `biome.json`
**Depends on**: T3
**Reuses**: Config Biome atual, suporte a parameter decorators e cuidado com DI/import-type.
**Requirement**: BOOT-01, OPS-05, QA-06.
**Done when**: [x] LF, aspas simples TS, dois espaços e largura 100; src/testes não ignorados; apenas gerados/build/deps/coverage excluídos; nenhum unsafe autofix funcional indiscriminado.
**Tests**: Regressão + >=3 verificações de configuração/formatação/escopo; suites preservadas após reformat.
**Gate**: B.
**Commit**: `style(tooling): enforce reviewed biome conventions`

#### T5: Validar e injetar configuração privada
**What**: Expandir loadConfig para API e seed com erros seguros, parse único e env de exemplo com placeholders.
**Where**: `apps/api/src/config/`
**Depends on**: T4
**Reuses**: Schema/testes de env atuais; Zod.
**Requirement**: BOOT-03, OPS-04, AUTH-01, CACHE-04.
**Done when**: [x] Todas as variáveis/unidades/limites da spec validados; seed credentials só no comando seed; invalid config falha sem segredos; fixture de integração recebe env sintético válido.
**Tests**: Unit + bootstrap/config, U01, >=12 casos/parametrizações incluindo segredo ausente/curto, URL, porta, TTL, timeout, issuer/audience e sentinelas.
**Gate**: Q e smoke de startup inválido sem listen.
**Commit**: `feat(config): validate api and seed environment safely`

#### T6: Extrair factory HTTP testável
**What**: Separar criação/configuração da aplicação de listen e sanitizar falha de bootstrap.
**Where**: `apps/api/src/application.ts`
**Depends on**: T5
**Reuses**: main/AppModule/controller atuais.
**Requirement**: BOOT-01, BOOT-04, ERR-06, DOC-05, OPS-04.
**Done when**: [x] Main usa factory e shutdown hooks; testes a usam sem listen; modo docs não inicializa conexões; startup não imprime error cru; nenhum seed automático. Hooks de segurança/Swagger serão registrados nas tarefas próprias, não simulados.
**Tests**: Unit/HTTP fixture + regressão, >=4 casos de create/listen/close/falha segura, U02 parcial.
**Gate**: B.
**Commit**: `refactor(api): separate application creation from listening`

### Phase 2: Persistência

#### T7: Modelar persistência e primeira migration de negócio
**What**: Criar schema/migration coerentes para o agregado Order/itens e usuário, incluindo revisão interna.
**Where**: `apps/api/prisma/schema.prisma`
**Depends on**: T6
**Reuses**: Prisma 7/PostgreSQL existentes; migração versionada, sem SQL de entrypoint.
**Requirement**: BOOT-02, ORDER-11, ORDER-14, CACHE-05, OPS-05.
**Done when**: [x] UUID, unique, enum, DATE, JSONB, timestamps UTC, FK/índices e cacheRevision 1 presentes; migrate deploy em banco vazio funciona; inspeção prova os tipos/constraints.
**Tests**: Integração real de migration com lifecycle existente e setup focal, I01, >=5 verificações de tipo/constraint/relacionamento/default.
**Gate**: F e prisma:validate; até T9 o teste focal aplica migration no container atual antes de inspecionar, sem adiar a prova.
**Commit**: `feat(database): add order aggregate and user migration`

#### T8: Garantir lifecycle e geração Prisma compatíveis
**What**: Adaptar provider compartilhado à config injetada e confirmar client gerado no runtime ESM compilado.
**Where**: `apps/api/src/prisma/prisma.service.ts`
**Depends on**: T7
**Reuses**: PrismaPg, PrismaModule e teste de shutdown.
**Requirement**: BOOT-01, BOOT-04, QA-03.
**Done when**: [x] Uma instância por app, connect/disconnect seguros; generator/client/adapter alinhados e Node compilado consulta PostgreSQL sem depender de Jest resolver.
**Tests**: Unit + integração, U02 e I01, >=3 casos de lifecycle/erro/consulta compilada, sem remover prova SELECT 1/current_database.
**Gate**: F.
**Commit**: `fix(database): align prisma lifecycle and esm runtime`

#### T9: Evoluir harness PostgreSQL para migrations e isolamento
**What**: Centralizar aquisição/teardown/reset de banco real e env em helper reutilizável nas provas HTTP.
**Where**: `apps/api/test/helpers/`
**Depends on**: T8
**Reuses**: setup Testcontainers atual, inclusive porta dinâmica e restauração de URL.
**Requirement**: QA-01, QA-02, QA-03, QA-04.
**Done when**: [x] Migrations reais antes de tests, dados resetados por caso, nenhuma URL externa de fallback; falha parcial libera recursos; Docker ausente falha; não criar container por teste.
**Tests**: Unit de lifecycle + integração do próprio helper, I32 parcial, >=5 casos: sem URL, sentinela externa, isolamento, falha parcial, Docker ausente.
**Gate**: F; testes reais de conexão não substituídos por doubles de lifecycle.
**Commit**: `test(harness): migrate and isolate disposable postgres suites`

#### T10: Criar seed idempotente e seguro
**What**: Implementar comando de seed do usuário e dos 12 pedidos reservados, com hashing seguro e fixtures variadas.
**Where**: `apps/api/prisma/seed.ts`
**Depends on**: T9
**Reuses**: Config seed, schema, client e harness; helper de hash extraído só se AuthService realmente reutilizar.
**Requirement**: OPS-02, OPS-03, OPS-04, AUTH-08.
**Done when**: [x] Duas execuções não duplicam itens/pedidos; cinco status e >=3 dias; alterar senha atualiza usuário; pedidos externos/seed excluído preservados; nada automático no startup.
**Tests**: Unit/falhas + PostgreSQL real I02/I03, >=5 casos, senha em hash e saída/log sem valor secreto.
**Gate**: F e B da etapa.
**Commit**: `feat(seed): add repeatable demo user and orders`

### Phase 3: Segurança e contrato

#### T11: Correlacionar requisições por UUID
**What**: Criar middleware de requestId sem confiar em ID arbitrário de entrada.
**Where**: `apps/api/src/common/http/`
**Depends on**: T10
**Reuses**: Factory, Node crypto e contexto HTTP.
**Requirement**: ERR-07.
**Done when**: [x] Toda resposta recebe X-Request-Id UUID novo e contexto interno correspondente, sem ecoar headers sensíveis.
**Tests**: Unit + HTTP, U22 parcial/I21 parcial, >=3 casos de UUID/header/contexto e ID hostil de entrada.
**Gate**: F.
**Commit**: `feat(http): correlate responses with generated request ids`

#### T12: Mapear somente conflitos Prisma conhecidos
**What**: Implementar mapper específico de constraint de orderNumber sem capturar outras falhas como conflito.
**Where**: `apps/api/src/common/errors/prisma-error.mapper.ts`
**Depends on**: T11
**Reuses**: Nome da constraint da migration, erros do Prisma 7.
**Requirement**: ERR-03, ERR-04.
**Done when**: [x] P2002 orderNumber vira erro de domínio; unique de email e outras falhas permanecem distintas/internas; sem mensagem SQL no erro público.
**Tests**: Unit U21 + conflito real com PostgreSQL, >=4 casos de constraint correta, outra unique, outro código e objeto desconhecido.
**Gate**: F.
**Commit**: `feat(errors): map only known order number conflicts`

#### T13: Padronizar falhas HTTP em Problem Details
**What**: Implementar filtro global e logging seguro da matriz, incluindo parse de JSON e exceções nativas.
**Where**: `apps/api/src/common/errors/problem-details.filter.ts`
**Depends on**: T12
**Reuses**: Mapper, requestId, exceptions Nest e factory.
**Requirement**: ERR-01, ERR-02, ERR-05, ERR-06, ERR-07, ERR-08.
**Done when**: [x] Content-type/envelope/status/code corretos, errors por campo e 500 genérico; native status preservado; logger allowlist não expõe exceção crua/PII.
**Tests**: Unit + HTTP/PostgreSQL, U22/U23/I21, >=8 casos para validação, JSON, native, 500, sentinelas, instance, requestId e 503 em controller de prova do filtro.
**Gate**: F.
**Commit**: `feat(errors): standardize safe problem details responses`

#### T14: Expor health de banco real
**What**: Implementar um endpoint público GET /api/v1/health, com seu contrato/documentação de disponibilidade.
**Where**: `apps/api/src/health/`
**Depends on**: T13
**Reuses**: Factory, PrismaService, requestId e filtro global já entregues; metadata pública será aplicada antes de instalar guard global.
**Requirement**: BOOT-05, BOOT-06, DOC-04.
**Done when**: [x] Banco acessível responde 200 exato; indisponível após startup responde 503 SERVICE_UNAVAILABLE em ProblemDetails com content-type e requestId; schemas/status/exemplos da unidade documentados.
**Tests**: Unit + HTTP/PostgreSQL real I22, >=4 casos de disponibilidade, consulta real, envelope 503 e falha sem detalhes do driver.
**Gate**: F.
**Commit**: `feat(health): report postgres availability over http`

#### T15: Implementar login JWT demonstrativo
**What**: Entregar POST /api/v1/auth/login completo, com schemas, service/wiring e contrato da única operação.
**Where**: `apps/api/src/auth/`
**Depends on**: T14
**Reuses**: User seed/hash, config, PrismaService e filtro; @nestjs/jwt compatível.
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-08, VAL-01, VAL-02, DOC-02, DOC-04.
**Done when**: [x] 200 TTL/tokenType exatos e claims mínimos HS256; email trim/lowercase, senha sem trim; credenciais erradas indistinguíveis; entrada estrita e OpenAPI com exemplos.
**Tests**: Unit + HTTP/PG + contrato U03/U04/I04, >=6 casos de login, inexistente, senha errada, email normalizado, schema e claims/TTL.
**Gate**: F.
**Commit**: `feat(auth): issue bearer tokens from demo credentials`

#### T16: Declarar metadata pública explícita
**What**: Criar @Public e aplicar somente nos controllers de login e health.
**Where**: `apps/api/src/common/decorators/public.decorator.ts`
**Depends on**: T15
**Reuses**: SetMetadata/Reflector; duas exceções definidas na spec.
**Requirement**: AUTH-05, AUTH-06.
**Done when**: [x] Metadata testada em método/classe, login/health públicos e controller legado sem metadata; não criar @CurrentUser sem consumidor.
**Tests**: Unit/metadata U06, >=3 casos de método, classe e ausência; bypass real entra junto do guard em T17.
**Gate**: Q.
**Commit**: `feat(auth): mark explicit public http operations`

#### T17: Proteger a aplicação com guard global
**What**: Implementar JWT guard APP_GUARD com bypass por metadata e principal mínimo.
**Where**: `apps/api/src/auth/jwt-auth.guard.ts`
**Depends on**: T16
**Reuses**: JWT config, decorator, filtro e AppModule real.
**Requirement**: AUTH-04, AUTH-05, AUTH-06, AUTH-07.
**Done when**: [x] Assinatura/algoritmo/exp/iss/aud validados; GET / protegido; login/health sem token; fixtures existentes preservadas e testes AppModule acrescentados; U07 N/A registrado sem decorator cosmético.
**Tests**: Unit + HTTP real, U05/U06/I05/I06, >=8 casos de tokens, metadata e rota privada fixture; endpoints futuros levam teste sem Bearer no seu commit.
**Gate**: F.
**Commit**: `feat(auth): protect routes with a global jwt guard`

#### T18: Publicar e exportar OpenAPI determinístico
**What**: Entregar pipeline Swagger UI/JSON e export versionado, extensível pelos endpoints seguintes.
**Where**: `apps/api/src/docs/`
**Depends on**: T17
**Reuses**: Factory sem init, metadata/schema dos endpoints existentes e filtro.
**Requirement**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, OPS-05.
**Done when**: [x] /docs e /docs-json públicos, bearerAuth; duas exportações idênticas sem DB/Redis; test:contract/docs:openapi reais; representação Standard Schema provada, fallback fino somente com falha documentada.
**Tests**: Unit/contrato/HTTP U29/I31 parciais, >=5 casos de schemas, security, export offline/determinístico, exemplo e erro; endpoints de pedidos completam sete operações em T25.
**Gate**: F e B da etapa.
**Commit**: `feat(openapi): expose and export deterministic api contracts`

### Phase 4: Pedidos

#### T19: Definir schemas estritos de pedidos e queries
**What**: Criar um módulo de schemas Zod e tipos inferidos para Create/PATCH/list/path, usado uma vez na borda.
**Where**: `apps/api/src/orders/schemas/orders.schemas.ts`
**Depends on**: T18
**Reuses**: Standard Schema, configuração de errors e enums persistidos sem expor Prisma no web.
**Requirement**: VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, VAL-06, LIST-01, LIST-03, LIST-07.
**Done when**: [x] Todos os limites/tipos/datas/defaults da spec e semântica de objetos/itens cobertos; números de query vazios/fracionários/arrays rejeitados; datas reais antes de construir UTC.
**Tests**: Unit U08–U13, >=20 casos parametrizados incluindo cada limite de string/item/preço/query/PATCH; schemas transformados em OpenAPI não perdem entrada escalar da query.
**Gate**: Q e test:contract de schema.
**Commit**: `feat(orders): define strict order input schemas`

#### T20: Apresentar DTOs públicos de pedidos
**What**: Implementar factories de detalhe/resumo/lista e schemas de saída sem SQL nem metadata privada.
**Where**: `apps/api/src/orders/dto/order.presenter.ts`
**Depends on**: T19
**Reuses**: Tipos de projeção derivados de select e conversões explícitas.
**Requirement**: ORDER-03, ORDER-04, ORDER-14, ORDER-15, LIST-05, LIST-06, DOC-02.
**Done when**: [x] DATE estável em dois fusos, instantes UTC, soma 4990 e 100000000000; campos exatos; totalPages zero/vazio; sem cacheRevision/deletedAt/hash.
**Tests**: Unit/contrato U19/U20, >=7 casos de total, timezone, projeção e paginação.
**Gate**: Q e test:contract de saída.
**Commit**: `feat(orders): present explicit public order responses`

#### T21: Criar pedido atomicamente via POST
**What**: Entregar um endpoint POST com validação, service/repository concretos, nested write e documentação.
**Where**: `apps/api/src/orders/`
**Depends on**: T20
**Reuses**: Guard, schemas, presenter, Prisma e mapper.
**Requirement**: ORDER-01, ORDER-02, ORDER-11, ORDER-12, VAL-01, VAL-02, VAL-03, VAL-05, ERR-03, DOC-03, DOC-04.
**Done when**: [x] 201/Location e persistência exatos; default PENDING; rollback e disputa de número comprovados; sem Bearer 401; inválido 400; conflito 409 e responses OpenAPI da rota.
**Tests**: Unit + HTTP/PG + contrato U14/I07/I11/I14/I19/I20, >=8 cenários, incluindo falha de itens e mesmo número soft-deleted.
**Gate**: F.
**Commit**: `feat(orders): create orders and items atomically`

#### T22: Detalhar pedido ativo por UUID
**What**: Entregar GET /orders/:id sem cache inicialmente, com snapshot coerente de pedido/itens e DTO.
**Where**: `apps/api/src/orders/`
**Depends on**: T21
**Reuses**: Repository/service/presenter/guard; select restrito, leitura RepeatableRead para snapshot completo.
**Requirement**: ORDER-03, ORDER-04, ORDER-10, ORDER-14, ORDER-15, AUTH-07, DOC-03, DOC-04.
**Done when**: [x] 200 shape exato, 404 inexistente/excluído, path inválido 400, sem token 401; dois usuários acessam; itens/revisão do mesmo snapshot; docs da rota presentes.
**Tests**: Unit + HTTP/PG + contrato U15/I08/I06 parcial/I19, >=7 casos, incluindo total máximo/DATE e projeção sem campos privados.
**Gate**: F.
**Commit**: `feat(orders): read active order details by uuid`

#### T23: Listar pedidos por filtros e paginação
**What**: Entregar GET /orders com projeção enxuta e total obtido pelo mesmo filtro.
**Where**: `apps/api/src/orders/`
**Depends on**: T22
**Reuses**: Schemas query, presenter de resumo e repository concreto.
**Requirement**: LIST-01, LIST-02, LIST-03, LIST-04, LIST-05, LIST-06, LIST-07, DOC-03, DOC-04.
**Done when**: [x] Filtros AND, trim/exato/case-sensitive, limites UTC, sort com empate, defaults/meta/vazio; sem itens ou paginação em memória; docs/query/security/erros presentes.
**Tests**: Unit + HTTP/PG + contrato U18/I16/I17/I18/I19, >=9 cenários incluindo limites exatos e count/filter iguais.
**Gate**: F.
**Commit**: `feat(orders): list active orders with exact filters`

#### T24: Atualizar pedido e substituir itens por PATCH
**What**: Entregar PATCH condicional ativo e transacional, preservando omissões e incrementando revisão.
**Where**: `apps/api/src/orders/`
**Depends on**: T23
**Reuses**: Schemas/presenter e protocolo de update pai antes de itens do design.
**Requirement**: ORDER-05, ORDER-06, ORDER-07, ORDER-08, ORDER-10, ORDER-11, ORDER-12, ORDER-13, VAL-04, ERR-03, DOC-04.
**Done when**: [x] Items omitido preserva IDs; presente substitui todos; objetos substituídos inteiros; count 0 impede write; rollback preserva revisão/dados; qualquer enum permitido e unicidade não mascarada.
**Tests**: Unit + HTTP/PG + contrato U16/I09/I10/I12/I14/I15 parcial, >=10 casos incluindo PATCHes concorrentes e pedido tornado inativo por transação de prova.
**Gate**: F.
**Commit**: `feat(orders): patch active orders with atomic item replacement`

#### T25: Excluir pedido logicamente por DELETE
**What**: Entregar DELETE condicional que preserva linhas/número e conclui a prova integrada das cinco operações.
**Where**: `apps/api/src/orders/`
**Depends on**: T24
**Reuses**: Repository, guard, mapper e revisão atômica.
**Requirement**: ORDER-09, ORDER-10, ORDER-11, ORDER-13, LIST-02, DOC-01, DOC-02, DOC-03, DOC-04.
**Done when**: [x] 204 zero bytes; segunda exclusão/leitura/PATCH 404; lista omite; número reservado; corrida PATCH/DELETE não ressuscita; OpenAPI tem sete operações completas com schemas/erros esperados.
**Tests**: Unit + HTTP/PG + contrato U17/I13/I14/I15/I31, >=7 casos incluindo linhas preservadas, concorrência e corpo 204 vazio.
**Gate**: F e B da etapa.
**Commit**: `feat(orders): soft delete orders without releasing numbers`

### Phase 5: Cache

#### T26: Gerenciar cliente Redis com deadline e cleanup
**What**: Criar provider compartilhado Redis e incorporar Redis real descartável ao harness existente.
**Where**: `apps/api/src/cache/redis.service.ts`
**Depends on**: T25
**Reuses**: Config, lifecycle/harness PostgreSQL; cliente node-redis compatível com Node escolhido.
**Requirement**: CACHE-04, CACHE-08, QA-02, QA-03, QA-08.
**Done when**: [x] Startup fail-open, ready/offline queue explícitos, deadline de conexão/comando, error handler seguro e close; helper isola/limpa namespace exclusivo por teste, encerra Redis e restaura env até em falha parcial.
**Tests**: Unit + Redis real, U02/U25/I27/I32, >=6 casos de conexão, timeout, indisponibilidade, cleanup e env; nenhuma fila tardia sem controle.
**Gate**: F.
**Commit**: `feat(cache): manage bounded redis operations safely`

#### T27: Codificar entradas de detalhe com TTL e métricas
**What**: Criar OrdersDetailCache com codec estrito, chave versionada e contadores verificáveis.
**Where**: `apps/api/src/cache/orders-detail.cache.ts`
**Depends on**: T26
**Reuses**: RedisService, schema público de saída; envelope interno revision/data.
**Requirement**: CACHE-01, CACHE-04, CACHE-06, CACHE-07, CACHE-08.
**Done when**: [x] GET/SET/DEL finitos, TTL padrão 60, id/revisão/shape validados; payload inválido vira miss; erro não escapa para API; logs/keys sem PII.
**Tests**: Unit + Redis real U24/U25/U28/I24/I30, >=7 casos de roundtrip, TTL, codec inválido/id errado, erro e contadores.
**Gate**: F.
**Commit**: `feat(cache): encode versioned expiring order detail entries`

#### T28: Aplicar cache-aside na leitura de detalhe
**What**: Integrar OrdersDetailReader ao GET detail sem mudar seu contrato nem contornar autenticação.
**Where**: `apps/api/src/orders/orders-detail.reader.ts`
**Depends on**: T27
**Reuses**: Service/repository/presenter existentes e cache; projeção de revisão ativa.
**Requirement**: CACHE-01, CACHE-02, CACHE-04, CACHE-05, CACHE-06, CACHE-07, CACHE-08, ORDER-10, QA-08.
**Done when**: [x] Miss preenche, hit da revisão atual não lê itens; entrada antiga/excluída/erro não serve dado não autorizado; banco fora não autoriza cache cego; lista/login/404 não geram entrada.
**Tests**: Unit + HTTP/PG/Redis U24/U25/U27/I23/I24/I27/I29/I30, >=9 cenários, snapshot/repopulação antiga com barreiras e respostas miss/hit equivalentes.
**Gate**: F.
**Commit**: `feat(cache): serve revision-checked order detail cache hits`

#### T29: Invalidar cache após PATCH commitado
**What**: Integrar invalidação pós-commit ao caso de uso PATCH, sem Redis dentro da transação.
**Where**: `apps/api/src/orders/orders.service.ts`
**Depends on**: T28
**Reuses**: OrdersDetailCache.invalidate e revisão atômica existente.
**Requirement**: CACHE-03, CACHE-04, CACHE-05, ORDER-12, QA-08.
**Done when**: [x] Sucesso tenta DEL após commit; rollback não o faz; DEL falho não muda sucesso do banco; próximo GET vê dado novo mesmo com entrada antiga recuperada.
**Tests**: Unit + HTTP/PG/Redis U26/I25/I28/I29, >=5 cenários incluindo falha de DEL e GET antigo gravando após invalidação.
**Gate**: F.
**Commit**: `feat(cache): invalidate order details after committed patches`

#### T30: Invalidar cache após DELETE commitado
**What**: Integrar invalidação pós-commit na exclusão e comprovar que cache nunca ressuscita pedido.
**Where**: `apps/api/src/orders/orders.service.ts`
**Depends on**: T29
**Reuses**: Mesma operação concreta de invalidação, guard de atividade/revisão no reader.
**Requirement**: CACHE-03, CACHE-04, CACHE-05, CACHE-06, ORDER-09, ORDER-10, QA-08.
**Done when**: [x] Após DELETE, GET novo 404 mesmo se DEL falhar/GET antigo repopular; não cachear ausência; contadores e cleanup seguros; nenhuma mudança de semântica pública.
**Tests**: Unit + HTTP/PG/Redis U26/U27/I26/I28/I29/I30, >=5 cenários de exclusão, cache antigo e falha de Redis.
**Gate**: F e B da etapa.
**Commit**: `feat(cache): invalidate deleted orders without stale resurrection`

### Phase 6: Plataforma web

#### T31: Inicializar SPA Vite/shadcn no workspace
**What**: Adicionar app web real com composition root, TypeScript, shadcn/Tailwind, Biome e Vitest, sem SSR.
**Where**: `apps/web/`
**Depends on**: T30
**Reuses**: pnpm/Turbo/estilo da raiz; configurar somente componentes necessários.
**Requirement**: WEB-01, MONO-01, MONO-02, MONO-03, QA-05.
**Done when**: [x] App renderiza shell, build estático e testes DOM funcionam; scripts reais e coverage 80/70 da lógica própria; proxy Vite /api e env público restrito; Node/versões compatíveis registrados.
**Tests**: Componentes/estrutural, >=4 casos de renderização, build/proxy/env e workspace; E05 ampliado, sem teste vazio para passar runner.
**Gate**: W e regressão B com ambos os apps.
**Commit**: `feat(web): bootstrap a typed vite spa with shadcn ui`

#### T32: Centralizar transporte HTTP web
**What**: Implementar cliente fetch tipado para JSON/ProblemDetails/204/rede e Bearer injetado.
**Where**: `apps/web/src/lib/http-client.ts`
**Depends on**: T31
**Reuses**: Contrato OpenAPI exportado; tipos locais públicos sem import do Prisma/segredos.
**Requirement**: WEB-02, WEB-03, WEB-09, DOC-03.
**Done when**: [x] 204 não tenta parse JSON; 400 conserva fields, 409 code, 401 protegido notifica sessão; abort não vira falso erro; sem retry automático POST/PATCH/DELETE e sem token em URL.
**Tests**: Unit U30/U33, >=8 casos de status, rede, cancelamento e headers; payloads confrontados com contrato real exportado.
**Gate**: W.
**Commit**: `feat(web): handle typed api requests and problem details`

#### T33: Manter sessão somente em memória
**What**: Criar SessionProvider com login/logout/expiração e limpeza de dados pendentes.
**Where**: `apps/web/src/features/auth/session-provider.tsx`
**Depends on**: T32
**Reuses**: React Context e callback 401 do HTTP client.
**Requirement**: WEB-02, WEB-03.
**Done when**: [x] Token não vai a storage/cookie/URL; logout/reload/401 limpa sessão e dados; erro de credenciais não gera loop de expiração; pending requests não repovoam estado após logout.
**Tests**: Componentes U30, >=5 casos de login, logout, novo mount, 401 e request antigo.
**Gate**: W.
**Commit**: `feat(web): keep bearer sessions in memory only`

#### T34: Proteger rotas e compor layout acessível
**What**: Adicionar layout/guard de navegação declarativo com Outlet e logout, registrando páginas conforme forem entregues.
**Where**: `apps/web/src/app/`
**Depends on**: T33
**Reuses**: SessionProvider, React Router declarativo e primitives shadcn.
**Requirement**: WEB-01, WEB-03, WEB-10.
**Done when**: [x] Visitante volta ao login, autenticado alcança shell protegido e logout; / redireciona conforme sessão; não registrar páginas CRUD falsas para aparentar fluxo pronto.
**Tests**: Componentes/MemoryRouter U30/U35, >=5 casos de acesso, redirecionamento, logout, navegação/foco e rota desconhecida.
**Gate**: W.
**Commit**: `feat(web): add protected navigation and application layout`

#### T35: Padronizar estados assíncronos visuais
**What**: Criar componente pequeno de loading/vazio/erro com retry explícito para as páginas de leitura.
**Where**: `apps/web/src/components/async-state.tsx`
**Depends on**: T34
**Reuses**: Primitives shadcn e mensagens seguras do HTTP client.
**Requirement**: WEB-09, WEB-10.
**Done when**: [x] Estados mutuamente corretos, retry acionável por teclado, sem exibir payload sensível ou anunciar sucesso em erro; login mantém comportamento específico de formulário.
**Tests**: Componentes U33/U35, >=4 casos de loading/vazio/erro/retry com nomes acessíveis.
**Gate**: W.
**Commit**: `feat(web): expose accessible asynchronous view states`

#### T36: Provisionar harness browser com stack real
**What**: Criar lifecycle E2E que inicia API/web de prova e bancos descartáveis, com smoke real de infraestrutura e teardown seguro.
**Where**: `apps/web/test/e2e/`
**Depends on**: T35
**Reuses**: Helper Testcontainers já migrado/Redis, seed, API compilada e Vite proxy.
**Requirement**: QA-02, QA-03, QA-04, QA-09, WEB-01.
**Done when**: [x] Chromium real, context por teste, env/portas exclusivos, sem reutilizar serviço da pessoa; carrega shell SPA e consulta health/login HTTP reais de prova; limpar DB/cache/processos ao falhar; comando real test:e2e:web sem cache. Ainda não alegar login visual ou CRUD prontos.
**Tests**: Browser/infra, >=5 casos de assets, API/PG/Redis acessíveis, isolamento de contextos/dados e falha parcial; testes visuais de login são co-localizados com T37 e CRUD com suas páginas.
**Gate**: H.
**Commit**: `test(web): provision isolated browser flows against real services`

#### T37: Entregar tela de login
**What**: Implementar página de login com formulário, pending e falhas reais da API.
**Where**: `apps/web/src/features/auth/login-page.tsx`
**Depends on**: T36
**Reuses**: HTTP client, SessionProvider, router, shadcn e harness browser já disponível.
**Requirement**: WEB-02, WEB-03, WEB-09, WEB-10, QA-09.
**Done when**: [x] Credenciais corretas abrem /orders (shell até T38); erro seguro preserva controle do usuário; pending bloqueia duplicação; labels/teclado; sessão expirada diferenciada de senha incorreta; logout/reload exigem login sem storage.
**Tests**: Componentes U30/U33/U34/U35 + browser E02/E04, >=8 casos de sucesso/401/rede/validação/duplo clique/foco/logout/reload, incluindo duas larguras.
**Gate**: H e fechamento da etapa com build/regressão dos apps.
**Commit**: `feat(web): authenticate through an accessible login page`

### Phase 7: Lista e formulário

#### T38: Listar e filtrar pedidos na web
**What**: Entregar uma página de lista com filtros, paginação e estados, consumindo somente resumo da API.
**Where**: `apps/web/src/features/orders/orders-list-page.tsx`
**Depends on**: T37
**Reuses**: Cliente, router/layout, AsyncState e primitives de tabela/filtro.
**Requirement**: WEB-04, WEB-09, WEB-10, LIST-01, LIST-05.
**Done when**: [ ] Query exata, reset page 1 ao aplicar filtros, meta/prev/next/vazio corretos; cancelar/ignorar resposta antiga; sem N requisições por item para montar tabela.
**Tests**: Componentes U31/U33 + browser da lista E01 parcial, >=7 casos de filtros combinados, limpeza, paginação, vazio, rede/retry e corrida de resposta.
**Gate**: H.
**Commit**: `feat(web): browse orders with filters and pagination`

#### T39: Modelar valores e payloads do formulário
**What**: Criar funções puras de estado/validação de edição e serialização Create/PATCH.
**Where**: `apps/web/src/features/orders/order-form-model.ts`
**Depends on**: T38
**Reuses**: Tipos públicos/OpenAPI e semântica da spec; sem pacote compartilhado ou service no browser.
**Requirement**: WEB-05, WEB-07, VAL-01, VAL-04.
**Done when**: [ ] Centavos inteiros, DATE texto; PATCH só alterações com objetos/coleção completos; ids de item não enviados; mudança inexistente não envia PATCH vazio; validação cliente não cria regra nova de negócio.
**Tests**: Unit U32, >=9 casos de create, diff escalar/objeto/itens, omissão/limpeza complement, preço float, datas e sem alteração.
**Gate**: W.
**Commit**: `feat(web): serialize precise order form changes`

#### T40: Editar coleção de itens no formulário
**What**: Criar ItemsEditor acessível com adicionar/remover/descrição/preço em centavos.
**Where**: `apps/web/src/features/orders/items-editor.tsx`
**Depends on**: T39
**Reuses**: Form model e input/button shadcn.
**Requirement**: WEB-05, WEB-07, WEB-10, VAL-01, VAL-04.
**Done when**: [ ] Respeita 1..50 e preço inteiro 0..2000000000; não inventa quantity; preserva identidade local de input para foco ao remover/adicionar.
**Tests**: Componentes U32/U34/U35, >=6 casos de mínimo/máximo/zero/invalid-price/remover/foco.
**Gate**: W.
**Commit**: `feat(web): edit order items as an accessible collection`

#### T41: Capturar dados de cliente
**What**: Criar grupo CustomerFields com valores, labels e mensagens por campo.
**Where**: `apps/web/src/features/orders/customer-fields.tsx`
**Depends on**: T40
**Reuses**: Form model e primitives shadcn.
**Requirement**: WEB-05, WEB-07, WEB-10, VAL-05.
**Done when**: [ ] Name/document editáveis e erros associados; documento genérico permitido; sem máscara/algoritmo CPF/CNPJ obrigatório ou log de documento.
**Tests**: Componentes U32/U35, >=3 casos de valor, documento genérico e mensagens/labels acessíveis.
**Gate**: W.
**Commit**: `feat(web): collect order customer fields accessibly`

#### T42: Capturar endereço de entrega
**What**: Criar grupo AddressFields completo com complement opcional e UF/CEP conforme API.
**Where**: `apps/web/src/features/orders/address-fields.tsx`
**Depends on**: T41
**Reuses**: Form model e primitives shadcn.
**Requirement**: WEB-05, WEB-07, WEB-10, VAL-03.
**Done when**: [ ] Todos os campos da spec, complement pode ser removido sem merge invisível, UF uppercase e postalCode texto de oito dígitos; labels/erros e foco corretos.
**Tests**: Componentes U32/U35, >=4 casos de edição completa, complement ausente, UF/CEP e mensagens acessíveis.
**Gate**: W.
**Commit**: `feat(web): collect complete delivery addresses`

#### T43: Compor formulário de pedido reutilizável
**What**: Compor os grupos prontos com número/status/previsão, validação e callback de submit sem chamar API internamente.
**Where**: `apps/web/src/features/orders/order-form.tsx`
**Depends on**: T42
**Reuses**: Model, CustomerFields, AddressFields, ItemsEditor, shadcn.
**Requirement**: WEB-05, WEB-07, WEB-09, WEB-10.
**Done when**: [ ] Estado inicial/create/edit corretos, messages 400/409 distribuídas, pending bloqueia submit, falha preserva dados; reset de initial order não mistura dois pedidos.
**Tests**: Componentes U32/U33/U34/U35, >=6 casos de composição, submit, pending, erros, valores iniciais/reset e teclado.
**Gate**: W e H de regressão da etapa; fluxo HTTP de criação/edição será habilitado nas páginas próprias, não fingido por callback.
**Commit**: `feat(web): compose the reusable order form`

### Phase 8: Fluxo web completo

#### T44: Exibir detalhe do pedido
**What**: Entregar página de detalhe e formatação pública BRL/DATE sem deslocamento local.
**Where**: `apps/web/src/features/orders/order-detail-page.tsx`
**Depends on**: T43
**Reuses**: Reader HTTP existente, AsyncState, router e formatting helpers pequenos.
**Requirement**: WEB-06, WEB-09, WEB-10, ORDER-14, ORDER-15.
**Done when**: [ ] Exibe DTO e total R$ 49,90 para 4990, DATE igual, máximo total; estados loading/404/erro/retry; não aparece metadata interna; navegação de lista abre pedido real.
**Tests**: Componentes U35 + browser E01 parcial/E04, >=6 casos incluindo dois fusos, rede/404 e request antigo.
**Gate**: H.
**Commit**: `feat(web): display order details with precise dates and totals`

#### T45: Criar pedido pela interface
**What**: Entregar página de criação conectando OrderForm ao POST real e navegação ao detalhe existente.
**Where**: `apps/web/src/features/orders/create-order-page.tsx`
**Depends on**: T44
**Reuses**: Form, HTTP, detalhe/router e lista existentes.
**Requirement**: WEB-05, WEB-09, WEB-10, QA-09.
**Done when**: [ ] POST conforme contrato, 201 abre detalhe; 400/409 no campo certo; rede preserva dados e não retry automático; duplo clique não duplica.
**Tests**: Componentes + browser E01 parcial/E03/E04, >=6 casos de sucesso, payload, 400, conflito real, rede e pending.
**Gate**: H.
**Commit**: `feat(web): create orders through the real api`

#### T46: Editar pedido pela interface
**What**: Entregar página de edição carregando detalhe e enviando somente mudanças conforme PATCH.
**Where**: `apps/web/src/features/orders/edit-order-page.tsx`
**Depends on**: T45
**Reuses**: OrderForm/model, cliente, reader e router.
**Requirement**: WEB-07, WEB-09, WEB-10, QA-09.
**Done when**: [ ] Sem mudança não envia {}; escalar omite items; item/objeto alterado é completo; após sucesso recarrega detalhe confirmado/cache atualizado; 400/409/404 não simulam sucesso.
**Tests**: Componentes + browser E01 parcial/E03/E04, >=7 casos de omissão/substituição, ausência de mudanças, conflito/404, pending e snapshot novo.
**Gate**: H.
**Commit**: `feat(web): edit orders with explicit patch semantics`

#### T47: Confirmar exclusão e fechar fluxo vertical
**What**: Entregar diálogo de exclusão e sua integração às ações de pedido, sem adicionar outro mecanismo de mutation.
**Where**: `apps/web/src/features/orders/delete-order-dialog.tsx`
**Depends on**: T46
**Reuses**: AlertDialog shadcn, cliente HTTP, detalhe/lista e estados existentes.
**Requirement**: WEB-08, WEB-09, WEB-10, QA-09.
**Done when**: [ ] Cancelar não chama; confirmar espera 204 e atualiza lista; último item em página posterior retorna à anterior; pending/foco/erro corretos; E01–E04 completos com stack real.
**Tests**: Componentes U34/U35 + browser E01/E03/E04, >=6 casos incluindo cancelamento, confirmação, double-click, rede, 404 e paginação pós-delete.
**Gate**: H e coverage/regressão completa dos dois apps da etapa.
**Commit**: `feat(web): confirm order deletion and refresh browsing state`

### Phase 9: Empacotamento e entrega

#### T48: Empacotar API e migrations em imagem multi-stage
**What**: Criar Dockerfile API com runtime não-root, target migrate e smoke focal executável.
**Where**: `apps/api/Dockerfile`
**Depends on**: T47
**Reuses**: Build Prisma/Node ESM validado, lockfile/workspaces e DB de prova.
**Requirement**: PACK-01, BOOT-01, OPS-04, OPS-05.
**Done when**: [ ] Build frozen, runtime só dist/client/deps necessárias, nenhum .env/segredo, UID não-root; target migrate aplica migrations versionadas; API compilada responde health/login com PG real, sem seed no startup.
**Tests**: Smoke de imagem E06/API + integração, >=5 verificações de build, UID, arquivos, migrate e HTTP; cria test:containers real para seleção API, não um no-op de Compose futuro.
**Gate**: C/API e H de regressão.
**Commit**: `build(api): package a non-root runtime and migration target`

#### T49: Empacotar SPA e proxy de produção
**What**: Criar imagem web estática não-root com Nginx, fallback visual e /api proxy separado.
**Where**: `apps/web/Dockerfile`
**Depends on**: T48
**Reuses**: Vite dist, config pública sem segredos e API container real.
**Requirement**: PACK-01, PACK-03, WEB-01.
**Done when**: [ ] Imagem serve assets e reload de rota visual; /api mantém status/headers e nunca retorna fallback HTML para erro; sem SSR/segredo no bundle; UID não-root.
**Tests**: Smoke real E06/web e E07/proxy parcial, >=5 casos de UID/assets/rota profunda/404 API/Location/header; ampliar runner focal, sem esperar T50 para provar imagem.
**Gate**: C/web e H.
**Commit**: `build(web): serve the spa through a non-root api proxy`

#### T50: Orquestrar stack Compose com prontidão e persistência
**What**: Expandir Compose existente com Redis/migrate/API/web e dependências operacionais corretas.
**Where**: `docker-compose.yml`
**Depends on**: T49
**Reuses**: PostgreSQL 17/volume atual, imagens testadas e health API.
**Requirement**: OPS-01, PACK-02, PACK-03, PACK-04, OPS-04.
**Done when**: [ ] config válida, portas loopback configuráveis, Redis sem exposição/persistência, migrate antes da API, web pronto, down/up conserva PG; nenhuma remoção de volume da pessoa, nenhum seed automático.
**Tests**: Smoke Compose real E07/E08, >=6 casos de config/saúde/ordem/proxy/persistência/perda de Redis, em projeto/volumes/portas de prova exclusivos.
**Gate**: C completo e H.
**Commit**: `build(compose): orchestrate the complete local stack safely`

#### T51: Fechar agregador de qualidade da entrega
**What**: Implementar check completo e verificação de contrato/coverage sem atalhos de cache ou falso sucesso.
**Where**: `package.json`
**Depends on**: T50
**Reuses**: Todos os scripts/provas já implementados; nada de concentrar testes funcionais ausentes aqui.
**Requirement**: OPS-05, QA-05, QA-06, MONO-03, DOC-05.
**Done when**: [ ] check encadeia todas as provas exigidas e propaga falha de cada etapa; cobertura real 80/70 por app; OpenAPI versionado sem drift; testes infra sempre executados; registrar comandos/exit codes, não promessa de sucesso.
**Tests**: Estruturais/agregador + gate real completo, >=3 provas de falha propagada/sem cache/coverage gate e todas as suites preservadas.
**Gate**: A; se Docker/browser indisponível, tarefa fica aberta.
**Commit**: `build(quality): enforce complete delivery verification gates`

#### T52: Registrar trade-offs técnicos finais
**What**: Produzir decisions.md refletindo escolhas realmente implementadas e desvios documentados.
**Where**: `docs/decisions.md`
**Depends on**: T51
**Reuses**: Spec/design, commits e resultados reais das etapas.
**Requirement**: DOC-06, CACHE-05, WEB-01, MONO-01.
**Done when**: [ ] Todas as decisões exigidas na spec cobertas, inclusive cache solicitado sem alegação de ganho medido, consulta de revisão, JWT em memória, JSONB/centavos/DATE/queries, ESM/versões e limites de auth; nenhum bônus fingido.
**Tests**: Revisão documental vinculada a código/contrato e gate completo, >=4 checks de cobertura de decisões, links, desvio/justificativa e coerência com runtime.
**Gate**: A e validação documental.
**Commit**: `docs(architecture): record implemented decisions and trade-offs`

#### T53: Documentar e reproduzir o roteiro do avaliador
**What**: Finalizar README com instalação, execução, seed/login/CRUD/web/testes e limitações verificadas.
**Where**: `README.md`
**Depends on**: T52
**Reuses**: Scripts/Compose/docs/contratos e evidências reais; usuário faz merges.
**Requirement**: DOC-06, OPS-05, QA-06, QA-07.
**Done when**: [ ] Roteiro reproduzido em ambiente de prova e curls coerentes; scripts/portas/semântica/erros/limitações completos; registro final da etapa e traceabilidade atualizados antes do commit. QA-07 continua pendente até fechamento independente abaixo.
**Tests**: Documental + smoke de roteiro real E05–E08 e fluxo E01, >=5 checks de instalação/env/migration-seed/login-CRUD/web/comandos e gate completo; sem executar no banco da pessoa.
**Gate**: A e validadores de spec/tarefas; após commit começa fechamento independente, não aprovação por autoavaliação.
**Commit**: `docs(readme): document and prove the evaluator workflow`

## Correções do plano

Itens exigidos pela spec que nenhuma tarefa numerada cobria, entregues como commits atômicos extras:

| Item | Requisito | Commit |
| --- | --- | --- |
| CORS configurável (uma origem explícita, nada sem `CORS_ORIGIN`) e helmet, com CSP desligado só nas páginas `/docs` | Spec, seção Configuração; CORS na tabela de decisões | `feat(http): apply configurable cors and security headers` na branch `feat/naporta-web-platform` |

## Fechamento independente após T53

V1 não é tarefa de implementação do autor. Após o commit de T53, um Verifier fresco, sem herdar conclusões do autor, rederiva cada AC, confronta asserts com resultados definidos na spec, executa mutações comportamentais em scratch isolado, verifica porcelain real antes/depois e escreve validation.md com PASS/FAIL, file:line, comandos e diff range. QA-07 só pode ser Verified depois desse relatório e validate_state.py PASS.

Relatório independente pode ser versionado por commit documental próprio após a verificação; não é permitido incluí-lo antecipadamente no commit de T53. Gaps geram tarefas corretivas atômicas na branch de entrega, com nova verificação, até três ciclos antes de escalar. Sem push/merge. Em parada por bloqueio, registrar o que não foi provado, sem Done.

## Task Granularity Check

| Tarefas | Unidade principal | Julgamento |
| --- | --- | --- |
| T1 | Política seletiva de rastreamento documental | Uma entrega documental, sem código de app |
| T2 | Relocation mecânica da API | Uma refatoração atômica; arquivos/paths precisam mover juntos para build continuar válido |
| T3, T4 | Grafo de tarefas; política de formatter, separadamente | Uma configuração transversal por commit |
| T5, T6 | Config; factory, separadamente | Um componente por tarefa |
| T7 | Schema persistente e migration correspondente | Um modelo relacional coerente num schema; não empacota CRUD |
| T8, T9, T10 | Provider; harness; seed, separadamente | Um componente/comando por tarefa |
| T14, T15, T21–T25 | Um endpoint por tarefa | Repository/service/wiring/docs/testes auxiliares só daquela operação |
| T11–T13, T16–T18 | Middleware, mapper, filtro, metadata, guard e pipeline docs | Um componente por tarefa |
| T19, T20 | Módulo de schemas e presenter, separadamente | Cada unidade tem um arquivo principal, sem banco/endpoint próprio |
| T26–T28 | Provider, cache codec e reader, separadamente | Um componente por tarefa |
| T29, T30 | Hook de invalidação de um caso de uso | Uma alteração de fluxo por commit |
| T31 | Bootstrap do segundo app | Composition root e toolchain mínima para build/teste, não todas as páginas |
| T32–T37 | Cliente, sessão, layout/route guard, async state, harness e login | Um componente/página por tarefa |
| T38–T47 | Página ou componente/model de formulário | Um componente/página por tarefa; customer/endereço/itens separados |
| T48, T49 | Uma imagem/runtime por tarefa | Dockerfile + configuração e smoke inseparáveis da imagem |
| T50, T51 | Orquestração local; agregador de qualidade | Uma superfície operacional por tarefa |
| T52, T53 | Um documento por tarefa | Sem agrupar README/decisions num commit monolítico |

## Diagram-Definition Cross-Check

As dependências são uma cadeia total operacional; a coluna Diagram Shows identifica a seta de entrada exata, inclusive entre etapas. Nenhuma seta adicional representa paralelismo ou dependência futura.

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Origem sem seta | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |
| T5 | T4 | T4 -> T5 | Match |
| T6 | T5 | T5 -> T6 | Match |
| T7 | T6 | T6 -> T7 | Match |
| T8 | T7 | T7 -> T8 | Match |
| T9 | T8 | T8 -> T9 | Match |
| T10 | T9 | T9 -> T10 | Match |
| T11 | T10 | T10 -> T11 | Match |
| T12 | T11 | T11 -> T12 | Match |
| T13 | T12 | T12 -> T13 | Match |
| T14 | T13 | T13 -> T14 | Match |
| T15 | T14 | T14 -> T15 | Match |
| T16 | T15 | T15 -> T16 | Match |
| T17 | T16 | T16 -> T17 | Match |
| T18 | T17 | T17 -> T18 | Match |
| T19 | T18 | T18 -> T19 | Match |
| T20 | T19 | T19 -> T20 | Match |
| T21 | T20 | T20 -> T21 | Match |
| T22 | T21 | T21 -> T22 | Match |
| T23 | T22 | T22 -> T23 | Match |
| T24 | T23 | T23 -> T24 | Match |
| T25 | T24 | T24 -> T25 | Match |
| T26 | T25 | T25 -> T26 | Match |
| T27 | T26 | T26 -> T27 | Match |
| T28 | T27 | T27 -> T28 | Match |
| T29 | T28 | T28 -> T29 | Match |
| T30 | T29 | T29 -> T30 | Match |
| T31 | T30 | T30 -> T31 | Match |
| T32 | T31 | T31 -> T32 | Match |
| T33 | T32 | T32 -> T33 | Match |
| T34 | T33 | T33 -> T34 | Match |
| T35 | T34 | T34 -> T35 | Match |
| T36 | T35 | T35 -> T36 | Match |
| T37 | T36 | T36 -> T37 | Match |
| T38 | T37 | T37 -> T38 | Match |
| T39 | T38 | T38 -> T39 | Match |
| T40 | T39 | T39 -> T40 | Match |
| T41 | T40 | T40 -> T41 | Match |
| T42 | T41 | T41 -> T42 | Match |
| T43 | T42 | T42 -> T43 | Match |
| T44 | T43 | T43 -> T44 | Match |
| T45 | T44 | T44 -> T45 | Match |
| T46 | T45 | T45 -> T46 | Match |
| T47 | T46 | T46 -> T47 | Match |
| T48 | T47 | T47 -> T48 | Match |
| T49 | T48 | T48 -> T49 | Match |
| T50 | T49 | T49 -> T50 | Match |
| T51 | T50 | T50 -> T51 | Match |
| T52 | T51 | T51 -> T52 | Match |
| T53 | T52 | T52 -> T53 | Match |

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Ignore/documentos | Documental/estrutural | Documental/estrutural | OK |
| T2 | Relocation | Regressão/build | Regressão/build/runtime | OK |
| T3 | Workspace/scripts | Estrutural + regressão | Grafo/scripts e regressão | OK |
| T4 | Biome | Estrutural + regressão | Config/formatação e regressão | OK |
| T5 | Config | Unit/bootstrap | U01/bootstrap | OK |
| T6 | Factory | Unit/HTTP | Unit/HTTP e regressão | OK |
| T7 | Schema/migration | DB real | I01 no próprio commit | OK |
| T8 | Provider DB | Unit/DB | Unit/DB/runtime | OK |
| T9 | Harness | Lifecycle + DB | Lifecycle/DB/falha infra | OK |
| T10 | Seed | Unit/DB | Unit/I02/I03 | OK |
| T11 | Middleware | Unit/HTTP | Unit/HTTP | OK |
| T12 | Mapper | Unit/DB | Unit/conflito real | OK |
| T13 | Filter/log | Unit/HTTP | Unit/I21 e 503 de prova | OK |
| T14 | Health | Unit/HTTP/DB | Unit/I22 e contrato completo da unidade | OK |
| T15 | Login | Unit/HTTP/DB/contrato | Unit/I04/contrato | OK |
| T16 | Metadata | Unit | Unit de metadata | OK |
| T17 | Guard | Unit/HTTP real | Unit/I05/I06 | OK |
| T18 | Docs pipeline | Contrato/HTTP | U29/I31 e offline export | OK |
| T19 | Schemas | Unit/contrato | U08–U13/contrato | OK |
| T20 | Presenter | Unit/contrato | U19/U20/contrato | OK |
| T21 | POST | Unit/HTTP/DB/contrato | U14/I07/I11/I14/I19/I20 | OK |
| T22 | Detail GET | Unit/HTTP/DB/contrato | U15/I08/I06/I19 | OK |
| T23 | List GET | Unit/HTTP/DB/contrato | U18/I16–I19 | OK |
| T24 | PATCH | Unit/HTTP/DB/contrato | U16/I09/I10/I12/I14/I15 | OK |
| T25 | DELETE | Unit/HTTP/DB/contrato | U17/I13–I15/I31 | OK |
| T26 | Redis provider | Unit/Redis real | Unit/Redis e falha parcial | OK |
| T27 | Codec/cache | Unit/Redis real | U24/U25/U28/I24/I30 | OK |
| T28 | Reader | Unit/HTTP/PG/Redis | U24/U25/U27/I23/I24/I27/I29/I30 | OK |
| T29 | Invalidação PATCH | Unit/HTTP/PG/Redis | U26/I25/I28/I29 | OK |
| T30 | Invalidação DELETE | Unit/HTTP/PG/Redis | U26/U27/I26/I28/I29/I30 | OK |
| T31 | Web bootstrap | Componente/build | Render/infra/build | OK |
| T32 | HTTP client | Unit/contrato | U30/U33 + contrato | OK |
| T33 | Sessão | Componentes | U30 | OK |
| T34 | Guard/layout | Componentes | U30/U35 | OK |
| T35 | AsyncState | Componentes | U33/U35 | OK |
| T36 | Browser harness | Browser real/infra | Smoke real e lifecycle | OK |
| T37 | Login | Componentes/browser | U30/U33/U34/U35/E02/E04 | OK |
| T38 | Lista | Componentes/browser | U31/U33/E01 parcial | OK |
| T39 | Form model | Unit | U32 | OK |
| T40 | ItemsEditor | Componentes | U32/U34/U35 | OK |
| T41 | CustomerFields | Componentes | U32/U35 | OK |
| T42 | AddressFields | Componentes | U32/U35 | OK |
| T43 | OrderForm | Componentes | U32/U33/U34/U35 | OK |
| T44 | Detail page | Componentes/browser | U35/E01/E04 | OK |
| T45 | Create page | Componentes/browser | E01/E03/E04 | OK |
| T46 | Edit page | Componentes/browser | E01/E03/E04 | OK |
| T47 | Delete dialog | Componentes/browser | U34/U35/E01/E03/E04 | OK |
| T48 | API imagem | Build/smoke real | E06/API real | OK |
| T49 | Web imagem/proxy | Build/smoke real | E06/web e proxy real | OK |
| T50 | Compose | Smoke real | E07/E08 | OK |
| T51 | Check | Estrutural e gate real | Falha propagada/cache/coverage e A | OK |
| T52 | Decisions | Documental + runtime | Revisão ancorada e A | OK |
| T53 | README | Documental + roteiro real | Smoke roteiro e A | OK |

## Matriz requisito → tarefa responsável

Esta é alocação de trabalho, não evidência de implementação. A tarefa primária não dispensa requisitos transversais nas tarefas relacionadas. O checklist de spec permanece Pending até execução; Verified exige resultado completo, não mock equivalente à implementação.

| Requisito | Tarefa primária e apoio/fechamento |
| --- | --- |
| BOOT-01 | T2, T3, T4, T6, T8, T48 |
| BOOT-02 | T7 |
| BOOT-03 | T5 |
| BOOT-04 | T6, T8 |
| BOOT-05 | T14 |
| BOOT-06 | T14 |
| AUTH-01 | T15 |
| AUTH-02 | T15 |
| AUTH-03 | T15 |
| AUTH-04 | T17 e cada endpoint protegido T21–T25 |
| AUTH-05 | T16, T17 |
| AUTH-06 | T16, T17 |
| AUTH-07 | T22 |
| AUTH-08 | T10, T15 |
| ORDER-01 | T21 |
| ORDER-02 | T21 |
| ORDER-03 | T20, T22 |
| ORDER-04 | T20, T22 |
| ORDER-05 | T24 |
| ORDER-06 | T24 |
| ORDER-07 | T24 |
| ORDER-08 | T24 |
| ORDER-09 | T25 |
| ORDER-10 | T22, T24, T25 |
| ORDER-11 | T7, T21, T24, T25 |
| ORDER-12 | T21, T24 |
| ORDER-13 | T24, T25 |
| ORDER-14 | T7, T20, T22 |
| ORDER-15 | T20, T22 |
| LIST-01 | T19, T23 |
| LIST-02 | T23, T25 |
| LIST-03 | T19, T23 |
| LIST-04 | T23 |
| LIST-05 | T20, T23 |
| LIST-06 | T20, T23 |
| LIST-07 | T19, T23 |
| VAL-01 | T19 e cada endpoint T21–T25 |
| VAL-02 | T19 e cada endpoint T21–T25 |
| VAL-03 | T19, T21 |
| VAL-04 | T19, T24 |
| VAL-05 | T19, T21 |
| VAL-06 | T19 e provas HTTP T21–T25 |
| ERR-01 | T13 e cada endpoint T14/T15/T21–T25 |
| ERR-02 | T13, T19 e integração dos endpoints |
| ERR-03 | T12, T21, T24, T25 |
| ERR-04 | T12 |
| ERR-05 | T13 |
| ERR-06 | T6, T13 |
| ERR-07 | T11, T13 |
| ERR-08 | T13 |
| DOC-01 | T18, T25 |
| DOC-02 | T15, T18, T20, T25 |
| DOC-03 | T18, T19 e cada endpoint T21–T25 |
| DOC-04 | T14, T15, T18 e cada endpoint T21–T25 |
| DOC-05 | T18, T51 |
| DOC-06 | T52, T53 |
| OPS-01 | T50 |
| OPS-02 | T10 |
| OPS-03 | T10 |
| OPS-04 | T5, T6, T10, T48, T50 |
| OPS-05 | T3, T18, T48, T51, T53 |
| QA-01 | T9 e cada endpoint de integração |
| QA-02 | T9, T26, T36 |
| QA-03 | T8, T9, T26, T36 |
| QA-04 | T9, T36 |
| QA-05 | T3, T31, T51 |
| QA-06 | T3 e gates de todas as tarefas, fechamento T51/T53 |
| QA-07 | V1 após commit de T53, verificação independente obrigatória |
| QA-08 | T26–T30 |
| QA-09 | T36, T37, T38, T44–T47 |
| CACHE-01 | T27, T28 |
| CACHE-02 | T28 |
| CACHE-03 | T29, T30 |
| CACHE-04 | T26–T30 |
| CACHE-05 | T7, T24, T25, T28–T30 |
| CACHE-06 | T27, T28, T30 |
| CACHE-07 | T27, T28 |
| CACHE-08 | T26–T28 |
| WEB-01 | T31, T34, T49 |
| WEB-02 | T32, T33, T37 |
| WEB-03 | T32–T34, T37 |
| WEB-04 | T38 |
| WEB-05 | T39–T43, T45 |
| WEB-06 | T44 |
| WEB-07 | T39–T43, T46 |
| WEB-08 | T47 |
| WEB-09 | T32, T35, T37, T38, T43–T47 |
| WEB-10 | T34–T38, T40–T47 |
| MONO-01 | T1–T3, T31 |
| MONO-02 | T3, T31 |
| MONO-03 | T3, T31, T36, T51 |
| PACK-01 | T48, T49 |
| PACK-02 | T50 |
| PACK-03 | T49, T50 |
| PACK-04 | T50 |

**Cobertura planejada:** 95/95 requisitos alocados, 53 tarefas em nove etapas, todos os grupos U/I/E da spec referenciados. Nenhuma prova de implementação executada.

## Orçamento e delegação futura

Etapas têm de quatro a oito tarefas. Pelo orçamento de aproximadamente sete tarefas e sem dividir fases, o empacotamento proposto resulta em nove batches sequenciais (6, 4, 8, 7, 5, 7, 6, 4, 6 tarefas). A etapa de segurança tem oito tarefas pequenas e coesas; não ultrapassa o limite aproximado de dez para redivisão. Antes de Execute, oferecer execução inline ou workers por batch e obter consentimento; nenhum worker foi criado nesta rodada. Não escolher modelo por conta própria. O Verifier fresco após T53 continua obrigatório, independentemente da opção de implementação.

## Resultado desta rodada

Somente design, tasks e branches são produzidos/revisados, além da atualização de memória/links de planejamento. Validadores estruturais podem ser executados para assegurar integridade documental. Nenhum comando de Gate B0/Q/F/B/W/H/C/A é executado agora. Ao fechar o Plannotator, parar e aguardar nova autorização explícita para execução.
