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
- **Phase / Task**: T1–T47 concluídas, 47/53 tarefas concluídas.
- **Completed**: T44–T46 commitadas (até `d298db9`). T47: DeleteOrderDialog (shadcn AlertDialog) na lista e no detalhe: confirmação com título e descrição acessíveis, foco inicial em Cancelar e retorno ao gatilho, Esc/Cancelar não chamam a API, Confirmar envia um DELETE e só fecha e atualiza após o 204, não pode ser dispensado nem repetido enquanto pendente, falhas (rede, 404) mantêm o diálogo aberto com o motivo; lista recarrega, volta à página anterior quando a última página fica vazia e leva o foco ao título; detalhe volta à lista. Fluxo vertical E01 completo no browser real (criar, filtrar, abrir, editar, excluir, conferido pela API) mais cancelamento, clique duplo, rede, paginação e teclado em 390 px. Gate H e fechamento da etapa 8 verdes: 212 testes web (99,35% linhas, 93,4% branches), 41 e2e web, regressão completa e comandos da raiz.
- **In-progress**: Nada.
- **Next step**: T48 (Phase 9, branch feat/naporta-delivery: imagem Docker da API).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-orders.
