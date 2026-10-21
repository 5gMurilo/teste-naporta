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
- **Status**: T1–T53 concluídas e commitadas nas branches encadeadas `feat/naporta-persistence` até `feat/naporta-delivery` (ver branches.md). Verificação independente feita (`validation.md`, ciclo 1) e lacunas reverificadas (`revalidation.md`); `pnpm check` com exit 0 em clone limpo.
- **Next step**: o usuário revisa e faz os merges na ordem da cadeia. Nenhum push, merge ou rebase foi feito.
- **Blockers**: Nenhum. Requer Docker e `pnpm --filter @naporta/web exec playwright install chromium`.
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
