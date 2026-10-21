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
- **Phase / Task**: T1–T21 concluídas, 21/53 tarefas concluídas.
- **Completed**: Branch feat/naporta-orders; T19 `1c576ab`, T20 `5643add`. T21: `POST /api/v1/orders` (OrdersController/Service/Repository/Module) com nested write atômico, default PENDING, Location relativo, 409 por unique do banco (inclusive soft-deleted e concorrência), NUL rejeitado na validação (PostgreSQL não armazena), OpenAPI com exemplos e respostas 201/400/401/409/500. Rollback provado com trigger real no PostgreSQL. Gate F verde: 229 unitários, e2e 1, integração 38, contrato 14, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T22 (GET /api/v1/orders/:id).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-orders.
