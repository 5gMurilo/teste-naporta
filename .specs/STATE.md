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
- **Phase / Task**: T1–T29 concluídas, 29/53 tarefas concluídas.
- **Completed**: T26–T28 commitadas (até `6228857`); `63c753a` ignora .omc no biome e git. T29: OrdersService.patch tenta DEL do detalhe somente depois do commit da transação (nunca dentro dela), sem invalidar em rollback, 404, 400 ou 409; falha de DEL é absorvida e não muda o 200. Provado com PostgreSQL e Redis reais: entrada removida e próximo GET traz dados e revisão novos, rollback por trigger mantém a entrada válida, DEL que falha não permite servir dado velho (revisão incompatível). Também: sonda de porta no host nos contextos de teste (Postgres e Redis), porque o runtime de containers às vezes reporta pronto antes de a porta publicada aceitar conexões (causava falha intermitente do beforeAll). Gate F verde: 281 unitários, e2e 1, integração 116, contrato 22, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T30 (invalidação após DELETE; fecha a etapa 5 com gate B).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-cache.
