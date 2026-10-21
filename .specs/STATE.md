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
- **Phase / Task**: T1–T14 concluídas, 14/53 tarefas concluídas.
- **Completed**: T11–T13 commitadas (`8c5b8be`, `185735e`, `67b6fa6`). T14: `GET /api/v1/health` (`HealthController`/`HealthModule`) consulta `SELECT 1` real; 200 `{status:ok,database:up}` ou 503 SERVICE_UNAVAILABLE sem detalhe do driver (provado contra PostgreSQL real e contra porta inalcançável). `@nestjs/swagger` 12.0.2 adicionado; docs 200/503 declaradas por decorators (verificação via documento OpenAPI em T18). Gate F verde: 79 unitários, e2e 1, integração 13, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T15 (login JWT demonstrativo; adicionar @nestjs/jwt).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-security.
