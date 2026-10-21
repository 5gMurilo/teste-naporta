# naPorta: mapa de branches e entregas

**Status:** aprovado na revisão conjunta com [design.md](design.md) e [tasks.md](tasks.md), via Plannotator em 2026-10-21 (`decision: approved`). Nenhuma etapa executada.
**Regra ativa:** AD-001 em `.specs/STATE.md`, uma branch por etapa, commits atômicos por tarefa, merges pelo usuário.
**Execução bloqueada:** nesta rodada nenhuma branch, commit, merge ou push será criado, mesmo após aprovação no Plannotator.

## Etapas propostas

| Etapa | Branch de trabalho | Branch-base e ponto de partida | Tarefas | Critério para encerrar |
| --- | --- | --- | --- | --- |
| 1. Fundação do monorepo | `feat/postgres-testcontainers` (já existe) | HEAD inspecionado `f039f21`; preservar histórico existente | T1–T6 | Documentos rastreáveis seletivamente, API movida sem regressão, Turbo/Biome/config/factory com gates verdes |
| 2. Persistência e seed | `feat/naporta-persistence` | Último commit validado da etapa 1 | T7–T10 | Migrations, lifecycle, harness migrado/isolado e seed repetível aprovados pelos testes |
| 3. Segurança e contrato transversal | `feat/naporta-security` | Último commit validado de `feat/naporta-persistence` | T11–T18 | Request ID, erros, health, login, metadata/guard e pipeline OpenAPI testados |
| 4. Pedidos REST | `feat/naporta-orders` | Último commit validado de `feat/naporta-security` | T19–T25 | Cinco operações com validação/DTO/OpenAPI, rollback, filtros e concorrência demonstrados |
| 5. Cache-aside Redis | `feat/naporta-cache` | Último commit validado de `feat/naporta-orders` | T26–T30 | Redis real, miss/hit/TTL, fallback e invalidação PATCH/DELETE com corridas comprovadas |
| 6. Plataforma web autenticada | `feat/naporta-web-platform` | Último commit validado de `feat/naporta-cache` | T31–T37 | Vite/shadcn, cliente HTTP, sessão/rotas/login e harness browser real funcionando |
| 7. Lista e formulário web | `feat/naporta-web-forms` | Último commit validado de `feat/naporta-web-platform` | T38–T43 | Lista/filtros/paginação e componentes/form model com seus testes |
| 8. Fluxo web completo | `feat/naporta-web-orders` | Último commit validado de `feat/naporta-web-forms` | T44–T47 | Detalhe, criação, edição e exclusão, com E01–E04 completos e testes de cada fluxo |
| 9. Empacotamento e entrega | `feat/naporta-delivery` | Último commit validado de `feat/naporta-web-orders` | T48–T53 | Imagens/Compose reais, check completo, docs reproduzíveis; depois Verifier independente |

Os SHAs de término não existem ainda. Preenchê-los somente a partir dos commits/gates reais, nunca antecipar hashes. Se um nome proposto já existir ao iniciar execução, investigar sua origem; não sobrescrever ou reutilizar trabalho desconhecido.

## Cadeia de dependências

```text
feat/postgres-testcontainers
  -> feat/naporta-persistence
  -> feat/naporta-security
  -> feat/naporta-orders
  -> feat/naporta-cache
  -> feat/naporta-web-platform
  -> feat/naporta-web-forms
  -> feat/naporta-web-orders
  -> feat/naporta-delivery
```

As branches são empilhadas, não independentes partindo de main. Cada uma contém os commits anteriores por ancestralidade. Comparar a etapa com sua branch-base para revisar somente seu incremento. Os merges ficam a cargo do usuário, que poderá integrá-las na ordem das dependências. O agente não fará merges ou rebase para simular essa integração.

## Protocolo de commits

1. Antes de uma tarefa: conferir branch, status e dependências; preservar mudanças desconhecidas e parar se não for possível atribuí-las.
2. Implementar uma única unidade definida em tasks.md junto com seus testes; executar o gate correspondente.
3. Atualizar conclusão da tarefa e traceabilidade antes do commit. Marcar requisito como Verified somente quando sua prova estiver completa, não apenas porque uma tarefa relacionada terminou.
4. Validar a mensagem Conventional Commits com o script da skill; commitar somente o escopo da tarefa, nunca `git add .` indiscriminado.
5. Registrar SHA e resultado do gate no diário da etapa. Não usar commits vazios para representar testes que não rodaram.
6. Ao encerrar a etapa: executar seu gate de regressão, confirmar árvore limpa para arquivos rastreados, preencher SHA final e criar a próxima branch apenas quando execução tiver sido autorizada.

Cada tarefa tem uma mensagem sugerida em tasks.md. Documentos/testes auxiliares e registro da tarefa fazem parte do mesmo commit, não de um lote posterior. Uma etapa terá vários commits atômicos; não um commit monolítico de etapa.

## Planejamento e histórico ignorado

Hoje `.gitignore` ignora toda `.specs/`. T1 planeja exceções seletivas para o estado e esta feature; `.specs/features/bootstrap-api/` e `.specs/features/postgres-testcontainers/` continuam ignoradas. Os artefatos desta rodada permanecem locais até autorização para T1; nenhum force-add ou mudança no ignore é executado agora.

## Registro a preencher durante execução

| Etapa | SHA inicial real | SHA final validado | Gate/evidência | Estado |
| --- | --- | --- | --- | --- |
| 1 | f039f21, sujeito a reconciliação na retomada | Ainda não criado | Não executado | Not started |
| 2 | A obter após etapa 1 | Ainda não criado | Não executado | Not started |
| 3 | da928ff (etapa 2 validada) | bfb5702 | Gate B da etapa verificado pelos comandos da raiz | Done |
| 4 | bfb5702 (etapa 3 validada) | 7048fb4 | Gate B da etapa pelos comandos da raiz | Done |
| 5 | 7048fb4 (etapa 4 validada; ad7868e registra) | 3cd9798 | Gate B da etapa pelos comandos da raiz | Done |
| 6 | 3cd9798 (etapa 5 validada; 25fc3d5 registra) | cfedcf3 | Gate H e regressão dos dois apps pelos comandos da raiz | Done |
| 7 | cfedcf3 (etapa 6 validada; bce2a22 registra) | 2e62e32 | Gates W e H, regressão dos dois apps pelos comandos da raiz | Done |
| 8 | 2e62e32 (etapa 7 validada; 0de6c17 registra) | 8409d63 | Gates W e H, E01 a E04 completos com stack real, regressão pelos comandos da raiz | Done |
| 9 | A obter após etapa 8 | Ainda não criado | Não executado | Not started |

## Fechamento futuro

Após o commit de T53, um Verifier fresco executa checagem ancorada na spec, sensor de discriminação em scratch e relatório `validation.md`. Gaps viram correções atômicas na branch da entrega e nova verificação, com limite de três ciclos antes de escalada. Não marcar feature Done sem PASS e `validate_state.py` aprovado. Nenhum desses passos é autorizado nesta rodada de planejamento.
