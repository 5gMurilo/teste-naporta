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
- **Phase / Task**: Phase 1 — Fundação; T1–T3 concluídas, T4 pendente; 3/53 tarefas concluídas.
- **Completed**: T1 habilitou o tracking seletivo de `.specs/STATE.md` e `.specs/features/orders-api/**`; validadores estritos e verificações documentais passaram. T2 moveu a API para `apps/api`; instalação, Prisma, build, 15 testes de regressão e smoke Node compilado passaram. T3 adicionou Turbo, aliases/workspace checks e thresholds; cobertura atual 100% lines/branches, regressão e PostgreSQL real passaram.
- **In-progress**: Nenhuma tarefa em andamento entre commits.
- **Next step**: Executar T4 (política Biome), gate B e commit atômico.
- **Blockers**: Nenhum conhecido. Prisma CLI exige `DATABASE_URL`; os gates usaram URL sintética sem segredos. pnpm em modo não interativo requer `CI=true` para reinstalar módulos após mudança de configuração.
- **Uncommitted files**: Alterações da T2 em workspace, API relocada, lockfile, documentação e política de lint para os novos caminhos. Planos históricos permanecem ignorados.
- **Branch**: feat/postgres-testcontainers, HEAD f039f21 na reconciliação. O snapshot anterior sobre main/ausência de Testcontainers estava desatualizado em relação ao git.
