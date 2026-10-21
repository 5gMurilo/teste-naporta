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
- **Phase / Task**: Phase 2 — Persistência; T1–T8 concluídas, 8/53 tarefas concluídas.
- **Completed**: Phase 1 T1–T6 está commitada até `019b1f0`; T7 foi commitada em `da9a2a9`. T8 alinhou o generator Prisma com ESM e adicionou prova de propagação da falha de conexão. Gate F passou: validate, lint, format, typecheck, build, 49 testes unitários + 10 workspace, e2e (1) e integração PostgreSQL (3), incluindo SELECT 1/current_database pelo client compilado executado diretamente em Node ESM.
- **In-progress**: Commit atômico de T8.
- **Next step**: T9, centralizar lifecycle/cleanup e reset isolado do harness PostgreSQL sem fallback de URL.
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack.
- **Uncommitted files**: Ajuste do generator para ESM, testes lifecycle/runtime e atualização do estado da feature.
- **Branch**: feat/naporta-persistence.
