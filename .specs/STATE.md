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
- **Phase / Task**: T1–T33 concluídas, 33/53 tarefas concluídas.
- **Completed**: T31 `726b3ae`, T32 `c7f396a`. T33: SessionProvider/useSession com token só em ref (sem storage, cookie ou URL), login que descarta o resultado se a sessão mudou no meio, logout e 401 abortam toda requisição pendente via sinal de sessão (resposta tardia não repovoa a UI), 401 marca sessão expirada, credencial errada não, novo mount sempre anônimo. Gate W verde: 39 testes web, 100% linhas / 88,7% branches.
- **In-progress**: Nada.
- **Next step**: T34 (rotas protegidas e layout).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-platform.
