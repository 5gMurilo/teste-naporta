# Project state

## Decisions

None - o repositório começa vazio; as escolhas aprovadas para o bootstrap estão em `.specs/features/bootstrap-api/plan.md`.

### AD-001
- **Decision**: Usar uma branch por etapa/fase de desenvolvimento e um commit atômico por tarefa; iniciar a primeira etapa em `feat/postgres-testcontainers` e criar cada branch seguinte a partir do término validado da anterior.
- **Reason**: O usuário quer etapas separadas e fará os merges posteriormente; branches encadeadas preservam as dependências sem exigir merge durante a execução.
- **Trade-off**: As branches posteriores incluem os ancestrais das etapas anteriores; sua revisão deve comparar com a branch-base registrada, não necessariamente com main.
- **Scope**: Desenvolvimento da API, cache, frontend e empacotamento; mapa de branches e bases será registrado em tasks.md. Não fazer merge/push ou reescrever histórico existente sem autorização explícita.
- **Date**: 2026-10-21
- **Status**: active

## Handoff

- **Feature**: orders-api (`.specs/features/orders-api/spec.md`).
- **Phase / Task**: T1–T18 concluídas, 18/53 tarefas concluídas.
- **Completed**: T11–T17 commitadas (até `d4ef683`). T18: Swagger UI em `/docs` e JSON em `/docs-json` (públicos, fora dos controllers), esquema `bearerAuth`, GET / excluído do contrato, schemas ProblemDetails/ValidationProblemDetails/FieldError nomeados, documento com chaves ordenadas e export offline em `docs/openapi.json` (`pnpm docs:openapi` e `docs:openapi:check`, via build compilado com DATABASE_URL sintética). `test:contract` real (`test/contract/*.contract-spec.ts`). O loader ts-node/esm não resolve `@nestjs/swagger` (gera `.js.js`), então `dev` passou a compilar com tsc --watch e rodar `node --watch dist/main.js`. Gate F e B da etapa 3 verdes pelos comandos da raiz: lint, format:check, typecheck, build, test:unit (116), test:contract (7), e2e (1), integração (22), cobertura, docs:openapi:check.
- **In-progress**: Nada.
- **Next step**: T19 (Phase 4, branch feat/naporta-orders a partir de feat/naporta-security) — exige nova autorização; Phase 3 encerrada.
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-security.
