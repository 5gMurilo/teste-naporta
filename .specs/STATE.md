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
- **Phase / Task**: T1–T53 concluídas, 53/53 tarefas concluídas.
- **Completed**: T48–T52 commitadas (até `14eabcf`). T53: README em português reescrito (objetivo, stack e razões, pré-requisitos, início rápido em containers com seed explícito, desenvolvimento local, login e token, curls de CRUD e filtros, regras do contrato em centavos/data civil/UTC/PATCH/soft delete, matriz de erros, frontend com sessão em memória, cache hit/miss/TTL/invalidação/perda do Redis, tabela de scripts, estrutura e limitações). Roteiro REPRODUZIDO em ambiente de prova: (1) Compose com projeto exclusivo e comandos literais do README (up, seed, login, POST 201, listagem com filtros, detalhe, PATCH, DELETE 204, 404 seguinte, health direto e pelo web) e (2) desenvolvimento local (migrate deploy, seed, pnpm dev, health, proxy do Vite, login e 12 pedidos); nada da pessoa foi tocado e tudo foi removido. 13 testes documentais (scripts/docs.test.mjs) cobrem scripts citados, portas e variáveis, códigos de erro e Redis sem porta. Spec, design e branches com status atualizado; requisitos marcados Implemented, nenhum Verified, QA-07 pendente. Gate A: pnpm check completo em exit 0.
- **In-progress**: Nada.
- **Next step**: Fechamento independente (V1): Verifier fresco sobre T53; sem push nem merge.
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
