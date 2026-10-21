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
- **Phase / Task**: T1–T43 concluídas, 43/53 tarefas concluídas.
- **Completed**: T38–T42 commitadas (até `aa338ad`). T43: OrderForm criação/edição que não chama a API (entrega payload pronto ao onSubmit): número, status em pt-BR, previsão, CustomerFields, AddressFields, ItemsEditor; validação estrutural com foco no primeiro campo inválido (aplicado depois da renderização), envio único com formulário desabilitado e aria-busy, falha preserva tudo o que foi digitado, 409 no campo do número, 400 distribuído por campo (inclusive item N) com mensagens em pt-BR sem repetir texto da API, sem alteração na edição não envia e avisa, PATCH só com o que mudou, reinício completo ao trocar de pedido ou de versão salva (nunca mistura dois pedidos). Gates W e H e fechamento da etapa 7 verdes: 162 testes web (99,2% linhas, 92,8% branches), 18 e2e web, regressão da API e comandos da raiz.
- **In-progress**: Nada.
- **Next step**: T44 (Phase 8, branch feat/naporta-web-orders: detalhe do pedido).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-forms.
