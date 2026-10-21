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
- **Phase / Task**: T1–T39 concluídas, 39/53 tarefas concluídas.
- **Completed**: T38 `ab43ed6`. T39: order-form-model com funções puras: valores do formulário como texto, fromOrder (sem ids de item), validateForm só estrutural (obrigatório, preço em centavos inteiros, ao menos um item; limites de negócio ficam com a API), toCreatePayload (texto aparado, complemento omitido se vazio, centavos inteiros, sem ids nem chaves locais) e toPatchPayload (só o que mudou; customer, endereço e itens sempre inteiros; sem alteração devolve undefined, nunca PATCH vazio; data civil como texto em três fusos). Tipos públicos de pedido em api-types. Gate W verde: 126 testes web.
- **In-progress**: Nada.
- **Next step**: T40 (editor de itens acessível).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-forms.
