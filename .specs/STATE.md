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
- **Phase / Task**: Phase 2 — Persistência; T1–T9 concluídas, 9/53 tarefas concluídas.
- **Completed**: Phase 1 T1–T6 está commitada até `019b1f0`; T7/T8 estão commitadas em `da9a2a9` e `3f8110d`. T9 centralizou container, migration deploy, configuração temporária, reset PostgreSQL por caso e teardown. Gate F passou: lint, format, typecheck, build, 54 testes unitários + 10 workspace, e2e (1) e integração PostgreSQL (5). A integração foi iniciada com `DATABASE_URL` sentinela externa, mas migration e conexão real usaram o container; reset foi comprovado entre dois casos. Testes unitários cobrem URL ausente, URL sentinela, reset, falha parcial e runtime Docker ausente.
- **In-progress**: Commit atômico de T9.
- **Next step**: T10, seed explícito/idempotente do usuário demonstrativo e dos 12 pedidos reservados com fixtures determinísticas.
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack.
- **Uncommitted files**: Helper/testes do harness PostgreSQL, setup de integração e atualização do estado da feature.
- **Branch**: feat/naporta-persistence.
