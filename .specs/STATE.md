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
- **Phase / Task**: T1–T51 concluídas, 51/53 tarefas concluídas.
- **Completed**: T48 `cc5d430`, T49 `0f46dd5`, T50 `f739c32`. T51: `pnpm check` (scripts/check.mjs + scripts/lib/run-steps.mjs) encadeia lint, format:check, typecheck, test:scripts, build, test:unit, test:contract, docs:openapi:check, test:coverage, test:e2e, test:integration, test:e2e:web e test:containers, para na primeira falha (ou segue com --keep-going) e sempre termina com código diferente de zero se qualquer etapa falhar ou for pulada, listando cada etapa com seu exit code; um comando que nem inicia conta como falha. Os test:* e lint não têm cache no Turbo. 7 testes do agregador (cobertura dos gates exigidos, parada na primeira falha, --keep-going, sucesso só com todos zero, comando inexistente, turbo sem cache, thresholds 80/70). Gate A real: pnpm check completo em exit 0 (lint, format, typecheck, scripts, build, unit, contrato, drift do OpenAPI, cobertura, e2e, integração, e2e web, containers).
- **In-progress**: Nada.
- **Next step**: T52 (docs/decisions.md).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
