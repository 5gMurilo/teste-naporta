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
- **Phase / Task**: T1–T30 concluídas, 30/53 tarefas concluídas.
- **Completed**: T26–T29 commitadas (até `8e6d5c1`). T30: OrdersService.delete tenta DEL após o soft delete commitado; sem invalidar para 404 ou falha; 404 nunca é cacheado; DEL que falha ou escrita tardia de um GET antigo não ressuscitam o pedido porque o reader confirma no PostgreSQL que ele está ativo; número continua reservado. Provado em PostgreSQL e Redis reais. Gate F e B da etapa 5 verdes pelos comandos da raiz: 286 unitários, e2e 1, integração 121, contrato 22, cobertura, build e docs:openapi:check.
- **In-progress**: Nada.
- **Next step**: T31 (Phase 6, branch feat/naporta-web-platform: SPA Vite/shadcn em apps/web).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-cache.
