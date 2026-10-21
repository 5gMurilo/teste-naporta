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
- **Phase / Task**: T1–T23 concluídas, 23/53 tarefas concluídas.
- **Completed**: T19–T22 commitadas (até `049a081`). T23: `GET /api/v1/orders` com filtros AND (número exato com trim, status, período UTC semiaberto), sort createdAt DESC/id DESC, projeção de resumo sem itens, paginação e total pelo mesmo where no banco, página além do fim vazia, totalPages 0 quando vazio; query inválida retorna 400; OpenAPI com cada filtro como query string opcional. Gate F verde: 235 unitários, e2e 1, integração 69, contrato 18, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T24 (PATCH /api/v1/orders/:id).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-orders.
