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
- **Phase / Task**: T1–T46 concluídas, 46/53 tarefas concluídas.
- **Completed**: T44 `00b239c`, T45 `5b41047`. T46: rota /orders/:id/edit com EditOrderPage: carrega o pedido (hook useOrder compartilhado com o detalhe, que ganhou a ação Editar), mostra o OrderForm em modo edição e envia um único PATCH só com o que mudou (nada alterado não envia; status isolado omite itens; item alterado manda a lista inteira sem ids; complemento limpo manda o endereço inteiro sem ele); após 200 abre o detalhe, que lê o pedido confirmado; 400, 409 e 404 aparecem sem simular sucesso, falha de rede preserva as edições. Browser real: PATCH com corpo {status}, itens substituídos e cache nunca servindo a lista antiga, sem alteração sem requisição, número tomado, pedido excluído durante a edição. Gate H verde: 202 testes web, 34 e2e web.
- **In-progress**: Nada.
- **Next step**: T47 (exclusão com confirmação; fecha a etapa 8).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-orders.
