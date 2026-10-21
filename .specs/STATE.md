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
- **Phase / Task**: T1–T45 concluídas, 45/53 tarefas concluídas.
- **Completed**: T44 `00b239c`. T45: rota /orders/new com CreateOrderPage ligando o OrderForm a um único POST; 201 abre o detalhe, 400 e 409 aparecem nos campos certos mantendo o que foi digitado, falha de rede não é repetida (só o usuário reenvia), clique duplo não duplica, cancelar volta à lista; ação 'Novo pedido' na lista. Browser real: criação com dois itens em 390 e 1280 px conferida pela API, número duplicado, CEP inválido vindo da API, rede com um POST e sucesso no reenvio, clique duplo gera um pedido. Gate H verde: 191 testes web, 29 e2e web.
- **In-progress**: Nada.
- **Next step**: T46 (editar pedido).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-orders.
