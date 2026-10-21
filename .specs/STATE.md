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
- **Phase / Task**: T1–T25 concluídas, 25/53 tarefas concluídas.
- **Completed**: T19–T24 commitadas (até `a8a05f6`). T25: `DELETE /api/v1/orders/:id` (204 sem corpo) com updateMany condicional em id e deletedAt null, incremento de cacheRevision, linhas e itens preservados, número continua reservado, segunda exclusão/leitura/PATCH retornam 404 e a lista omite; corrida PATCH/DELETE e DELETE bloqueado por lock de exclusão concorrente provadas em PostgreSQL real. OpenAPI com as sete operações completas. Gate F e B da etapa 4 verdes pelos comandos da raiz: 244 unitários, e2e 1, integração 94, contrato 22, cobertura, build e docs:openapi:check.
- **In-progress**: Nada.
- **Next step**: T26 (Phase 5, branch feat/naporta-cache: cliente Redis com deadline).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-orders.
