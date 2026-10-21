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
- **Phase / Task**: T1–T27 concluídas, 27/53 tarefas concluídas.
- **Completed**: T26 `17a9b69`. T27: OrdersDetailCache (módulo renomeado para CacheModule) com chave `naporta:v1:orders:{id}:detail`, envelope estrito {revision, data} validado pelo schema público de saída e pelo id, TTL de CACHE_TTL_SECONDS, get(id, revisão) que só devolve a revisão exata, falhas e payload inválido absorvidos como miss, contadores hits/misses/errors sem payload ou id. Provado também contra Redis real (TTL, expiração, entrada corrompida, namespace). Gate F verde: 272 unitários, e2e 1, integração 104, contrato 22, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T28 (cache-aside no GET de detalhe).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-cache.
