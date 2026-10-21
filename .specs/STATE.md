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
- **Phase / Task**: T1–T52 concluídas, 52/53 tarefas concluídas.
- **Completed**: T48–T51 commitadas (até `16a0da4`) e correções `d592045`/`e10e4a0`. T52: docs/decisions.md com o que foi realmente implementado (estrutura, persistência e ESM, modelo de dados, validação, erros, autenticação, concorrência, cache-aside pedido pelo usuário com revisão persistida, invalidação pós-commit, fail-open, hit ainda consulta o banco e nenhum ganho alegado, OpenAPI, segurança HTTP, frontend com token em memória, testes, containers), tabela de desvios do plano com motivo e limitações verificadas; docs/INDEX.md. 7 testes documentais (scripts/docs.test.mjs): datas, cobertura dos temas exigidos, afirmações sobre o hit e o ganho, desvios com motivo, links existentes, coerência com o código (chave, TTL, timeout, índices, fila, isolamento) e ausência de emojis.
- **In-progress**: Nada.
- **Next step**: T53 (README e roteiro do avaliador).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
