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
- **Phase / Task**: T1–T31 concluídas, 31/53 tarefas concluídas.
- **Completed**: Etapa 5 encerrada em `3cd9798`; branch feat/naporta-web-platform; item extra CORS/helmet em `5e9e71e`. T31: apps/web com React 19.3.1, Vite 8.3.5, TypeScript 5.9.3 strict, Tailwind 4.3.3 + tw-animate-css, configuração shadcn (components.json, utils cn; CLI 4.22.1 validado, componentes só quando usados), Vitest 5.0.5 + Testing Library em jsdom, Biome com suporte a diretivas Tailwind e vendor shadcn fora do lint, proxy /api no dev (DEV_PROXY_TARGET, fora do namespace VITE_), único env público VITE_API_BASE_URL, cobertura 80/70 incluindo arquivos não importados. Raiz: lint e lint:fix passam a delegar ao Turbo para os dois apps; teste de workspace cobre o grafo com os dois pacotes. Gate W e B com ambos os apps verdes pelos comandos da raiz (web: 10 testes, 100% de cobertura nas linhas próprias).
- **In-progress**: Nada.
- **Next step**: T32 (cliente HTTP tipado da web).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-platform.
