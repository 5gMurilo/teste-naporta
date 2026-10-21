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
- **Phase / Task**: Phase 2 — Persistência encerrada; T1–T10 concluídas, 10/53 tarefas concluídas.
- **Completed**: T7–T9 commitadas (`da9a2a9`, `3f8110d`, `a64ffcc`). T10 adiciona `db:seed` (argon2id, usuário por email normalizado, 12 pedidos `SEED-NP-0001..0012` criados só se ausentes, sem tocar em pedidos externos ou soft-deleted). Gate F e B da etapa: lint, format:check, typecheck, build (com `DATABASE_URL` sentinela, exigida pelo `prisma generate`), 59 testes unitários + 10 workspace, e2e (1), integração PostgreSQL (7, seed executado via CLI contra o container) e cobertura 97,22% linhas / 76,92% branches. Saída do seed não contém senha nem hash.
- **In-progress**: Nada; T10 commitada em `da928ff`.
- **Next step**: T11 (Phase 3, branch `feat/naporta-security`) — fora da autorização atual; aguardar autorização explícita antes de criar a branch.
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-persistence.
