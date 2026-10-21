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
- **Phase / Task**: T1–T38 concluídas, 38/53 tarefas concluídas.
- **Completed**: Etapa 6 encerrada em `cfedcf3` (registro `bce2a22`); branch feat/naporta-web-forms. T38: página de lista em /orders com filtros (número, status em pt-BR, período) aplicados explicitamente, limpar, tabela só com o resumo da API (nenhuma requisição por item), paginação anterior/próxima com meta e botões desabilitados nas pontas, voltar à página 1 ao aplicar filtro, estados de carregando/vazio/erro com nova tentativa, resposta antiga ignorada por AbortController, período invertido barrado no cliente, data civil exibida sem deslocamento de fuso. Browser real: lista vazia, filtros por status/número/período, 21 pedidos em duas páginas, erro 503 com retry, sessão expirada com aviso. Gate H verde: 94 testes web, 18 e2e web.
- **In-progress**: Nada.
- **Next step**: T39 (modelo de formulário: payloads Create/PATCH).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-forms.
