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
- **Phase / Task**: Phase 1 — Fundação; T1–T5 concluídas, 5/53 tarefas concluídas.
- **Completed**: T1–T4 conforme histórico dos commits anteriores. T5 valida config API/seed com mensagens só de campos, injeta config validada uma vez no Prisma, fornece placeholders seguros, fixa `.env` raiz para API/Prisma CLI e configura env sintético na integração. Gates passaram: lint, typecheck, 44 testes unitários + 10 workspace, e2e (1), integração PostgreSQL (1), build, smoke de startup inválido e Prisma CLI com `DATABASE_URL` vindo do `.env` raiz.
- **In-progress**: Commit atômico de T5, já com status e rastreabilidade atualizados.
- **Next step**: Após o commit T5, executar T6 (factory HTTP testável); parar ao concluir T6.
- **Blockers**: Nenhum conhecido.
- **Uncommitted files**: Somente arquivos de implementação, testes, env de exemplo, README e status da T5.
- **Branch**: feat/postgres-testcontainers.
