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
- **Phase / Task**: T1–T15 concluídas, 15/53 tarefas concluídas.
- **Completed**: T11–T14 commitadas (até `5214dd8`). T15: `POST /api/v1/auth/login` (AuthModule/Controller/Service) com schema Zod estrito (`@Body({schema})` + `StandardSchemaValidationPipe` global), argon2 verify com hash descartável para email desconhecido, JWT HS256 (sub, email, iat, exp, iss, aud) via `@nestjs/jwt` 12.0.3, `InvalidCredentialsError` 401. Contrato OpenAPI do login gerado com `SwaggerModule.createDocument` e verificado em `login.contract.spec.ts`. Gate F verde: 90 unitários, e2e 1, integração 20, cobertura e build.
- **In-progress**: Nada.
- **Next step**: T16 (@Public).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-security.
