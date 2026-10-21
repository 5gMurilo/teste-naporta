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
- **Phase / Task**: T1–T20 concluídas, 20/53 tarefas concluídas.
- **Completed**: Phase 3 encerrada em `bfb5702` (branch feat/naporta-security). Branch feat/naporta-orders criada dela. T19 `1c576ab`: schemas Zod estritos de pedidos (create, PATCH, query, id) com testes U08–U13 e contrato de entrada. T20: schemas de saída (OrderResponse, OrderSummaryResponse, ListOrdersResponse), projeções Prisma por select e `OrderPresenter` (DATE por partes UTC, soma, totalPages) com testes U19/U20 em quatro fusos e contrato de saída. Gate F verde: 222 unitários, e2e 1, integração 22, contrato 12, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T21 (POST /api/v1/orders, repository, service, controller).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-orders.
