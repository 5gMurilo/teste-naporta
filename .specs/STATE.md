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
- **Phase / Task**: T1–T48 concluídas, 48/53 tarefas concluídas.
- **Completed**: Etapa 8 encerrada em `8409d63` (registro `e0d5356`); branch feat/naporta-delivery. T48: apps/api/Dockerfile multi-stage (contexto na raiz) com node:22.22.3-slim, pnpm via corepack, instalação `--frozen-lockfile`, stages dependencies/build/production-dependencies/migrate/runtime; runtime só com dist, node_modules de produção (pnpm deploy) e package.json, usuário node (UID 1000), HEALTHCHECK em /api/v1/health, sem .env nem segredos; target migrate roda `prisma migrate deploy` uma vez como job, nunca no startup. .dockerignore na raiz. pnpm-workspace libera o postinstall de prisma e @prisma/engines (o motor de schema precisa dele). `pnpm test:containers [api]` (scripts/containers, Node test runner, Docker real): build frozen, UID não-root, conteúdo mínimo e sem segredos, migrations aplicadas e idempotentes em PostgreSQL vazio, health 200 e login 401 INVALID_CREDENTIALS contra o banco real com Redis inalcançável e zero usuários (sem seed no startup), healthcheck, configuração inválida sem vazar segredo. Gates C/API e H verdes: 7 testes de container, regressão completa.
- **In-progress**: Nada.
- **Next step**: T49 (imagem da SPA com Nginx e proxy /api).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
