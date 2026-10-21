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
- **Phase / Task**: T1–T22 concluídas, 22/53 tarefas concluídas.
- **Completed**: T19–T21 commitadas (até `efe45ac`). T22: `GET /api/v1/orders/:id` sem cache, leitura do pedido, itens e cacheRevision num único snapshot RepeatableRead (repository), ORDER_NOT_FOUND para inexistente/excluído, id validado por schema de params (campo `id` no erro), mesma resposta do POST, DATE e total máximo estáveis em três fusos, dois usuários acessam. Gate F verde: 232 unitários, e2e 1, integração 48, contrato 16, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T23 (GET /api/v1/orders com filtros e paginação).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-orders.
