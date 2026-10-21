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
- **Phase / Task**: Phase 2 — Persistência; T1–T7 concluídas, 7/53 tarefas concluídas.
- **Completed**: Phase 1 T1–T6 está commitada até `019b1f0`. T7 adicionou os modelos User, Order e OrderItem, a enum OrderStatus e a migration PostgreSQL versionada. `prisma:validate`, build, lint, typecheck e a integração com PostgreSQL descartável passaram. A inspeção real confirmou UUID, timestamptz(3), DATE, JSONB, enum/defaults, unique indexes, FK e índices. A integração mantém os testes SELECT 1/current_database e adiciona a prova de migration/schema.
- **In-progress**: Commit atômico de T7.
- **Next step**: T8, provar lifecycle compartilhado e consulta do client Prisma em Node ESM compilado contra PostgreSQL real.
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack.
- **Uncommitted files**: Schema/migration Prisma, prova de integração do schema e atualização do estado da feature.
- **Branch**: feat/naporta-persistence.
