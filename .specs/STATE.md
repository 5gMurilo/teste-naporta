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
- **Phase / Task**: T1–T34 concluídas, 34/53 tarefas concluídas.
- **Completed**: T31–T33 commitadas (até `d5ef3da`). T34: rotas declarativas com React Router 8.5.0 (BrowserRouter no App, MemoryRouter nos testes): ProtectedRoute redireciona visitante ao /login, / redireciona conforme a sessão, /login redireciona autenticado para /orders, AppLayout com link de pular conteúdo, banner, navegação rotulada, e-mail, botão Sair (shadcn Button; import utils corrigido) e main focável que recebe o foco a cada navegação, página 404 dentro do layout. /login é um placeholder honesto até T37 e /orders um shell até T38; nenhuma página CRUD falsa. test-utils/render-app com API fake reutilizável. Gate W verde: 45 testes web.
- **In-progress**: Nada.
- **Next step**: T35 (estados assíncronos visuais).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-platform.
