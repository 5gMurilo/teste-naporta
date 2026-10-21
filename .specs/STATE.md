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
- **Phase / Task**: T1–T50 concluídas, 50/53 tarefas concluídas.
- **Completed**: T48 `cc5d430`, T49 `0f46dd5`. T50: docker-compose.yml com postgres (mesmo nome de volume postgres_data, healthcheck, porta em 127.0.0.1 configurável), redis (sem porta publicada e sem persistência), migrate (job único, o API só inicia após service_completed_successfully), api e web (health antes do tráfego, portas só em loopback) e o perfil tools com seed explícito (target seed do Dockerfile da API; nada de seed automático). JWT_SECRET vazio faz o API parar com 'API startup failed: Invalid environment fields: JWT_SECRET' (novo ConfigError só com nomes de variável), sem segredo padrão. 10 testes de Compose com projeto, volumes e portas exclusivos, que nunca tocam o projeto da pessoa: config inválida, migrate antes da API, só loopback e Redis sem exposição/persistência, zero dados no start, seed explícito e login/criação pelo proxy, rota profunda e erros JSON, docs e health, Redis reiniciado/parado/de volta (cache perdido sem afetar dados nem travar), down/up conservando o volume e o pedido, e Chromium entrando pela stack real. Gates C e H verdes: container tests api (7) e stack (10), regressão completa.
- **In-progress**: Nada.
- **Next step**: T51 (agregador de qualidade pnpm check).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
