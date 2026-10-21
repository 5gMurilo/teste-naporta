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
- **Phase / Task**: T1–T32 concluídas, 32/53 tarefas concluídas.
- **Completed**: T31 `726b3ae`. T32: `createHttpClient` em apps/web/src/lib: Bearer lido a cada requisição, 204 sem parse, ApiError com status/code/errors por campo/requestId, 401 com token notifica a sessão uma vez (login e requisição sem sessão não), corpo de erro que não é Problem Details vira mensagem genérica, NetworkError com mensagem segura, abort relançado como abort, nenhum retry em nenhum método, token fora da URL; payloads conferidos contra o docs/openapi.json real. Gate W verde: 30 testes web, cobertura 100% linhas / 90,9% branches.
- **In-progress**: Nada.
- **Next step**: T33 (sessão em memória).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-platform.
