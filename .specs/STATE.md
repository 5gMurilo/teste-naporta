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
- **Phase / Task**: Phase 1 — Fundação; T1–T6 concluídas, 6/53 tarefas concluídas.
- **Completed**: T1–T4 conforme histórico dos commits anteriores. T5 commitada em `3ebaf00` e validou configuração segura API/seed, injeção única e `.env` raiz. T6 extraiu `createApplication(config, mode)`, injetou a config dinâmica nos módulos, manteve listen/shutdown hooks no main, e adicionou quatro casos de factory. Gate B passou: lint, format check, typecheck, build, 48 testes unitários + 10 workspace, e2e (1), integração PostgreSQL (1), coverage 97.22% lines/76.92% branches; smoke inválido imprimiu somente mensagem sanitizada.
- **In-progress**: Commit atômico de T6, com status atualizado.
- **Next step**: Finalizar o commit T6 e parar na fronteira da Phase 1; T7 não autorizado nesta execução.
- **Blockers**: Nenhum conhecido.
- **Uncommitted files**: Implementação e testes da factory, wiring dos módulos, main e status T6.
- **Branch**: feat/postgres-testcontainers.
