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
- **Phase / Task**: T1–T17 concluídas, 17/53 tarefas concluídas.
- **Completed**: T11–T16 commitadas (até `eb3f8ad`). T17: `JwtAuthGuard` registrado como APP_GUARD em AuthModule; bypass só por metadata @Public; valida bearer, assinatura/algoritmo/exp/iss/aud (verifyOptions do JwtModule) e claims sub/email; principal mínimo em `request.principal`. GET / agora retorna 401 sem token (teste de request-id ajustado: o contrato mudou, a asserção de header permanece). U07 N/A: sem @CurrentUser. Gate F verde: 117 unitários, e2e 1, integração 22, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T18 (OpenAPI Swagger UI/JSON + export determinístico; fecha a Phase 3 com gate B).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-security.
