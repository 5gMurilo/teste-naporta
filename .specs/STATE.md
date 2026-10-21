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
- **Phase / Task**: T1–T44 concluídas, 44/53 tarefas concluídas.
- **Completed**: Etapa 7 encerrada em `2e62e32` (registro `0de6c17`); branch feat/naporta-web-orders. T44: rota /orders/:id com OrderDetailPage: campos públicos, endereço, itens e total em BRL por aritmética inteira (formatBRL; máximo R$ 1.000.000.000,00), data civil sem deslocamento de fuso, campos internos nunca renderizados, 404 com mensagem e link de volta sem retry, erro com retry, resposta antiga ignorada ao trocar de pedido; número do pedido na lista agora é link real. errorMessage passou a escrever pt-BR por código da API (nunca o texto em inglês). Browser real em 390 e 1280 px: lista para detalhe, deep link que volta ao pedido depois do login, pedido inexistente, total máximo. Gate H verde: 184 testes web (cobertura acima de 99% linhas), 23 e2e web.
- **In-progress**: Nada.
- **Next step**: T45 (criar pedido pela interface).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-orders.
