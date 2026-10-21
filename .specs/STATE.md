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
- **Phase / Task**: T1–T28 concluídas, 28/53 tarefas concluídas.
- **Completed**: T26–T27 commitadas (até `281153f`). T28: OrdersDetailReader aplicado ao GET de detalhe: consulta barata de existência ativa e revisão no PostgreSQL (404 sem tocar o cache), hit só da revisão exata sem carregar itens, miss carrega o snapshot e grava sob a revisão desse snapshot; Redis fora do ar, payload corrompido e entrada antiga viram leitura pelo banco. Provado com PostgreSQL e Redis reais: miss/hit idênticos e uma só leitura de itens, TTL, entrada de revisão antiga ignorada, escrita tardia de um GET antigo após PATCH não serve dado velho, exclusão não é ressuscitada, 404/lista/login não criam chaves, contadores, Redis indisponível. Gate F verde: 277 unitários, e2e 1, integração 112, contrato 22, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T29 (invalidação após PATCH commitado).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-cache.
