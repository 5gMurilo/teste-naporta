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
- **Phase / Task**: T1–T26 concluídas, 26/53 tarefas concluídas.
- **Completed**: Etapa 4 encerrada em `7048fb4` (feat/naporta-orders); branch feat/naporta-cache criada a partir dela. T26: RedisService/RedisModule global com node-redis 6.3.0 (fila offline desligada, conexão em segundo plano que nunca bloqueia o startup, reconexão com backoff, fila limitada a 100, handler de erro que guarda só o nome do erro, destroy no shutdown) e deadline de CACHE_TIMEOUT_MS por operação no serviço (o timeout nativo do node-redis deixa de valer depois que o comando é escrito; verificado com servidor RESP que não responde). Helper redis-test-context (Testcontainers redis:7-alpine, REDIS_URL restaurado, reset só do namespace naporta:). Configs de teste herméticas apontam para porta fechada. Gate F verde: 255 unitários, e2e 1, integração 100, contrato 22, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T27 (OrdersDetailCache com codec e TTL).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-cache.
