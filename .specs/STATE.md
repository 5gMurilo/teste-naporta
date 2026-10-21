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
- **Phase / Task**: T1–T13 concluídas, 13/53 tarefas concluídas.
- **Completed**: T11 `8c5b8be`, T12 `185735e`. T13: `ProblemDetailsFilter` global (`configureApplication` em application.ts) com `DomainError` genérico (status/code/detail), mapper Prisma, HttpException nativa preservada (HTTP_ERROR fora da matriz), errors por campo via `RequestValidationException`, 500 genérico e log allowlist (requestId, método, rota, status) para status >= 500. Gate F verde: 75 unitários, e2e 1, integração 11, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T14 (health com banco real).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-security.
