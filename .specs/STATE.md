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
- **Phase / Task**: T1–T49 concluídas, 49/53 tarefas concluídas.
- **Completed**: T48 `cc5d430`. T49: apps/web/Dockerfile (build com vite build, runtime nginxinc/nginx-unprivileged 1.29-alpine, UID 101, porta 8080) e nginx/default.conf.template renderizado pelo entrypoint com API_UPSTREAM: /api/ repassado sem reescrever status, corpo ou headers (Location, X-Request-Id), 502/504 do próprio nginx viram problem+json em vez de HTML, /assets/ (^~) com cache imutável e 404 real para arquivo ausente, qualquer caminho com extensão é arquivo ou 404, index.html sempre revalidado, rotas visuais caem na SPA, cabeçalhos de segurança e CSP restrita por snippet incluído em cada location. 7 testes de container (Docker real, upstream de teste e Chromium real): usuário não-root, só o bundle estático e sem .env, tipos e cache dos assets, recarga de rota profunda e 404 de arquivo, proxy fiel, 502 legível por máquina, headers e ausência de segredos no bundle, carga no browser sem violação de CSP. Gates C/web e H verdes: pnpm test:containers api e web, regressão web.
- **In-progress**: Nada.
- **Next step**: T50 (stack Compose completa).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-delivery.
