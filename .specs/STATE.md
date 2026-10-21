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
- **Phase / Task**: T1–T37 concluídas, 37/53 tarefas concluídas.
- **Completed**: T31–T36 commitadas (até `e5e6eec`). T37: LoginPage (shadcn Card/Input/Label/Button) com labels associados, validação cliente sem chamada à API, erro de credencial calmo em pt-BR (foco na senha, e-mail preservado), 400 mapeado nos campos sem repetir texto da API, falha de rede com nova tentativa, envio único durante a requisição (botão desabilitado, aria-busy, guarda contra Enter), aviso de sessão expirada diferente de senha incorreta, redirecionamento pós-login seguro (safeRedirect só aceita caminhos internos), nada de senha ou token em DOM, URL ou storage. Browser real: 7 cenários em 390 px e 1280 px (login, logout, reload exige novo login, senha errada, teclado sem rolagem horizontal, clique repetido gera uma só chamada). Gate H e fechamento da etapa 6 verdes: 84 testes web (99,4% linhas, 91,1% branches), 13 e2e web, regressão completa da API e comandos da raiz.
- **In-progress**: Nada.
- **Next step**: T38 (Phase 7, branch feat/naporta-web-forms: lista e filtros na web).
- **Blockers**: Nenhum conhecido. Docker disponível via OrbStack. `pnpm build` exige `DATABASE_URL` no ambiente (turbo `passThroughEnv`).
- **Uncommitted files**: Nenhum rastreado.
- **Branch**: feat/naporta-web-platform.
