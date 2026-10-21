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
- **Phase / Task**: T1–T24 concluídas, 24/53 tarefas concluídas.
- **Completed**: T19–T23 commitadas (até `825c2c6`). T24: `PATCH /api/v1/orders/:id` em transação ReadCommitted: updateMany condicional (id, deletedAt null) trava a linha pai e incrementa cacheRevision, count 0 vira ORDER_NOT_FOUND antes de tocar itens, itens só substituídos (deleteMany+createMany) quando enviados, customer/endereço substituídos por inteiro, 409 por unique. Provas em PostgreSQL real: rollback por trigger verificado em nova conexão, corrida de número com um vencedor, substituições concorrentes sem mistura, PATCH bloqueado por lock que depois exclui o pedido retorna 404 sem alterar dados (barreira via pg_stat_activity, sem sleeps). Gate F verde: 241 unitários, e2e 1, integração 88, contrato 20, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T25 (DELETE lógico; fecha a etapa 4 com gate B).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-orders.
