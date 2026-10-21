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
- **Phase / Task**: T1–T36 concluídas, 36/53 tarefas concluídas.
- **Completed**: T31–T35 commitadas (até `25d6cc4`). T36: harness Playwright 1.64.1 (Chromium) em apps/web/test/e2e: startStack sobe PostgreSQL e Redis descartáveis (helpers do Testcontainers da API), aplica migrations, semeia o usuário demo com senha aleatória, inicia a API compilada e o SPA buildado via vite preview com proxy /api em portas livres exclusivas, espera health e raiz, e libera tudo em ordem inversa também em falha parcial (testado sem Docker em stack.test.ts). resetData por teste limpa pedidos e namespace do Redis mantendo o usuário. 6 testes reais: assets da SPA sem erro, health direto e pelo proxy, login real (200 e 401), PG e Redis acessíveis, contextos isolados, dados limpos entre testes. Comando `pnpm test:e2e:web` sem cache, depende do build de API e web. Também: prisma:generate/validate usam uma DATABASE_URL de marcação quando ausente, então `pnpm build` funciona em checkout limpo sem env (nada conecta). Requer `pnpm exec playwright install chromium` uma vez. Gate H verde: 62 testes web, 6 e2e web, regressão completa da API.
- **In-progress**: Nada.
- **Next step**: T37 (tela de login; fecha a etapa 6).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-platform.
