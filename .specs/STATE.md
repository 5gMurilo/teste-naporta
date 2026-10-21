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
- **Phase / Task**: T1–T40 concluídas, 40/53 tarefas concluídas.
- **Completed**: T38 `ab43ed6`, T39 `b6aa3bd`. T40: ItemsEditor com 1 a 50 itens, labels por posição, preço em centavos como texto (zero permitido, ajuda 'Ex.: 4990 = R$ 49,90'), chave local estável por linha (digitar e adicionar outras linhas não remonta o input), foco no novo item ao adicionar e no item que ocupou o lugar ao remover, remover desabilitado no último item, adicionar desabilitado em 50 com explicação, erros associados por aria-describedby/aria-invalid e alerta da coleção, operação só por teclado. Gate W verde: 136 testes web.
- **In-progress**: Nada.
- **Next step**: T41 (campos de cliente).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-forms.
