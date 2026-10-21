# naPorta: API de pedidos, cache e frontend de validação

## Datas

- Criado em: 2026-10-21
- Última atualização: 2026-10-21

API REST de pedidos (NestJS, PostgreSQL, JWT) com cache-aside em Redis para o detalhe, uma SPA React para
validar o fluxo completo e tudo empacotado em Docker/Compose. As decisões e os trade-offs estão em
[docs/decisions.md](docs/decisions.md); o contrato HTTP, em [docs/openapi.json](docs/openapi.json) e no Swagger
UI (`/docs`).

## Stack e razões

| Peça | Escolha | Por quê |
| --- | --- | --- |
| API | NestJS 12, TypeScript estrito, ESM | Estrutura modular e injeção de dependência sem cerimônia extra |
| Banco | PostgreSQL 17 + Prisma 7 | Integridade relacional, unique para o número do pedido, transações |
| Validação e docs | Zod estrito + OpenAPI gerado dos mesmos schemas | Uma só fonte de regras para runtime e contrato |
| Autenticação | JWT HS256 + argon2id | Demonstrativa, simples e verificável |
| Cache | Redis, cache-aside só no detalhe | Atende ao pedido de cache sem arriscar consistência |
| Frontend | React 19, Vite 8, shadcn/ui, Tailwind 4 | SPA pequena, sem SSR |
| Monorepo | pnpm workspaces + Turborepo | Comandos únicos na raiz |
| Testes | Jest, Vitest, Testcontainers | Persistência e cache reais |

## Pré-requisitos

- Node.js 22.22.3 ou superior
- pnpm 10.33.0 (`corepack enable` instala a versão certa)
- Docker (Engine, Desktop ou OrbStack) com Docker Compose

```sh
pnpm install --frozen-lockfile
```

## Início rápido: tudo em containers

```sh
export JWT_SECRET="$(openssl rand -base64 48)"
docker compose up -d --build
```

`migrate` aplica as migrations e termina; só então a API sobe, e a web sobe depois da API. Nada é semeado
automaticamente. Para criar o usuário demonstrativo e 12 pedidos, execute o seed explícito:

```sh
export SEED_USER_EMAIL="demo@example.com"
export SEED_USER_PASSWORD="troque-por-uma-senha-sua"
docker compose run --rm seed
```

Portas (todas em `127.0.0.1`, configuráveis por `WEB_PORT`, `API_PORT` e `POSTGRES_PORT`):

| Serviço | Endereço padrão |
| --- | --- |
| Frontend | <http://127.0.0.1:8080> |
| API e Swagger | <http://127.0.0.1:3000> e <http://127.0.0.1:3000/docs> |
| PostgreSQL | `127.0.0.1:5432` |
| Redis | sem porta publicada |

Encerrar sem apagar dados: `docker compose down`. O volume `postgres_data` permanece. Apagar o volume
(`docker compose down -v`) é destrutivo e remove os pedidos locais.

## Desenvolvimento local

```sh
docker compose up -d --wait postgres              # só o banco; o Redis do Compose não publica porta
cp .env.example .env                              # preencha JWT_SECRET: openssl rand -base64 48
pnpm install --frozen-lockfile
pnpm db:migrate:deploy                            # aplica as migrations versionadas
SEED_USER_EMAIL=demo@example.com SEED_USER_PASSWORD=troque-por-uma-senha-sua pnpm db:seed
pnpm dev                                          # API (compilada em modo watch) e frontend (Vite)
```

Os dois `SEED_*` também podem ficar no `.env`. Para ter cache no desenvolvimento local, suba um Redis seu em
loopback (opcional):

```sh
docker run -d --rm --name naporta-redis -p 127.0.0.1:6379:6379 redis:7-alpine --save "" --appendonly no
```

- API: <http://localhost:3000>. Frontend em desenvolvimento: <http://localhost:5173>, com `/api` encaminhado
  para a API (`DEV_PROXY_TARGET`, padrão `http://localhost:3000`).
- Subir a API compilada sem watch: `pnpm start`. Produção da API sem containers: `pnpm build && pnpm start:prod`.
- Sem Redis a API funciona normalmente; só não há cache (o `REDIS_URL` do `.env.example` aponta para `localhost:6379`).
- Limite de login: `LOGIN_RATE_LIMIT` (padrão 5) tentativas por `LOGIN_RATE_TTL_SECONDS` (padrão 60) por endereço de cliente, contadas em memória do processo. `TRUST_PROXY_HOPS` (padrão 0; o Compose usa 1) diz quantos proxies reversos estão na frente da API, para contar o cliente real em vez do proxy.
- Variáveis em [.env.example](.env.example). `JWT_SECRET` precisa de 32 caracteres ou mais; configuração
  inválida impede a API de subir e a mensagem lista apenas os nomes das variáveis, nunca os valores.

## Usar a API: login, token e CRUD

```sh
API=http://127.0.0.1:3000
```

Login (200 com `accessToken`, `tokenType` e `expiresIn` em segundos):

```sh
TOKEN=$(curl -s -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$SEED_USER_EMAIL\",\"password\":\"$SEED_USER_PASSWORD\"}" | jq -r .accessToken)
```

Criar (201, com `Location`):

```sh
curl -si -X POST "$API/api/v1/orders" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "orderNumber": "NP-2026-0001",
    "expectedDeliveryDate": "2026-11-03",
    "customer": { "name": "Ana Silva", "document": "123.456.789-00" },
    "deliveryAddress": {
      "street": "Rua das Flores", "number": "101", "complement": "Apto 12",
      "neighborhood": "Centro", "city": "São Paulo", "state": "SP", "postalCode": "01001000"
    },
    "items": [
      { "description": "Café especial", "priceCents": 4990 },
      { "description": "Caneca", "priceCents": 0 }
    ]
  }'
```

Listar com filtros e paginação, detalhar, atualizar e excluir:

```sh
curl -s "$API/api/v1/orders?status=PENDING&createdFrom=2026-10-01&createdTo=2026-10-31&page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
curl -s "$API/api/v1/orders?orderNumber=NP-2026-0001" -H "Authorization: Bearer $TOKEN"

ID=00000000-0000-4000-8000-000000000000   # troque pelo id retornado
curl -s "$API/api/v1/orders/$ID" -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH "$API/api/v1/orders/$ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"status":"SHIPPED"}'
curl -si -X DELETE "$API/api/v1/orders/$ID" -H "Authorization: Bearer $TOKEN"
```

Saúde (público): `curl -s "$API/api/v1/health"` retorna `{"status":"ok","database":"up"}` após consultar o
banco de verdade, ou 503 se ele estiver indisponível.

### Regras do contrato

| Tema | Regra |
| --- | --- |
| Preço | Centavos inteiros de BRL (`4990` = R$ 49,90). O total é calculado e pode chegar a 100000000000 |
| Datas | `expectedDeliveryDate` é uma data civil `YYYY-MM-DD`, sem fuso. `createdAt` e `updatedAt` são instantes UTC |
| Filtro de período | `createdFrom` inclui o início do dia UTC; `createdTo` inclui o dia inteiro (limite exclusivo no dia seguinte) |
| Número do pedido | Filtro por igualdade exata, após remover espaços nas pontas, sensível a maiúsculas |
| Ordenação | `createdAt` decrescente e, em empate, `id` decrescente |
| PATCH | Pelo menos um campo. `customer`, `deliveryAddress` e `items` substituem o valor inteiro; `items` omitido mantém os itens e seus ids |
| Exclusão | Lógica: a linha e os itens permanecem; o número do pedido continua reservado (POST ou PATCH com ele dão 409) |
| Entrada | Estrita: propriedade desconhecida ou `null` no lugar de ausente é 400 |

### Erros

Sempre `application/problem+json` com `type`, `title`, `status`, `detail`, `instance`, `code` e `requestId`
(o mesmo valor do header `X-Request-Id`). Erros de validação trazem `errors: [{ field, message }]`.

| Situação | HTTP | `code` |
| --- | --- | --- |
| Entrada, caminho ou query inválidos, JSON malformado | 400 | `VALIDATION_ERROR` |
| Token ausente, inválido ou expirado | 401 | `UNAUTHORIZED` |
| E-mail inexistente ou senha incorreta | 401 | `INVALID_CREDENTIALS` |
| Pedido inexistente ou excluído | 404 | `ORDER_NOT_FOUND` |
| Número de pedido já usado, inclusive por pedido excluído | 409 | `ORDER_NUMBER_ALREADY_EXISTS` |
| Banco indisponível no health | 503 | `SERVICE_UNAVAILABLE` |
| Excesso de tentativas de login do mesmo cliente (padrão: 5 por 60 s), com `Retry-After` | 429 | `HTTP_ERROR` |
| Falha inesperada | 500 | `INTERNAL_SERVER_ERROR` |

## Frontend

Abra <http://127.0.0.1:8080> (containers) ou <http://localhost:5173> (`pnpm dev`) e entre com o e-mail e a
senha definidos em `SEED_USER_EMAIL` e `SEED_USER_PASSWORD` ao executar o seed. Telas: login, lista com
filtros e paginação, detalhe, criação, edição e exclusão com confirmação.

- O token fica **somente em memória**: recarregar a página encerra a sessão e leva ao login. Uma resposta 401
  também encerra a sessão, com um aviso de sessão expirada.
- Preços são digitados em **centavos**; datas de entrega são mostradas como escritas, sem conversão de fuso.
- O build é estático (`pnpm --filter @naporta/web build`, saída em `apps/web/dist`). No container, o Nginx
  serve os arquivos, devolve a SPA nas rotas visuais após um reload e encaminha `/api/` para a API sem
  reescrever status nem headers.
- Nenhum segredo entra no bundle: só variáveis `VITE_` chegam ao navegador, e a única existente é
  `VITE_API_BASE_URL` (opcional, vazia por padrão).

## Cache do detalhe

- Só `GET /api/v1/orders/:id` usa cache. Chave `naporta:v1:orders:{id}:detail`, TTL padrão de 60 s
  (`CACHE_TTL_SECONDS`), prazo de 200 ms por operação (`CACHE_TIMEOUT_MS`).
- **Miss:** lê o pedido no PostgreSQL e grava no Redis. **Hit:** devolve o payload gravado, sem recarregar os
  itens, mas só se a revisão do pedido no banco ainda for a mesma; essa checagem é uma consulta pequena.
- **Invalidação:** PATCH e DELETE tentam apagar a chave depois do commit. Mesmo se isso falhar, uma entrada
  antiga é descartada pela revisão.
- **Redis fora do ar ou apagado:** a API continua respondendo pelo PostgreSQL e o cache se repovoa sozinho.
  Não é feita nenhuma alegação de ganho de desempenho: não houve medição.

## Scripts (raiz)

| Comando | Efeito |
| --- | --- |
| `pnpm dev` | API em modo watch e frontend com Vite |
| `pnpm build` | Gera o client Prisma, compila a API e empacota o frontend |
| `pnpm start` | Compila a API e a executa uma vez, sem watch |
| `pnpm start:prod` | Executa a saída já compilada da API (o Turbo garante o build antes) |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate:dev` | Cria e aplica migrations em desenvolvimento; nunca em produção |
| `pnpm db:migrate:deploy` | Aplica as migrations versionadas |
| `pnpm db:seed` | Seed explícito e idempotente (`SEED_USER_EMAIL`, `SEED_USER_PASSWORD`) |
| `pnpm docs:openapi` | Exporta `docs/openapi.json` (determinístico, sem banco) |
| `pnpm docs:openapi:check` | Falha se `docs/openapi.json` estiver desatualizado |
| `pnpm lint`, `lint:fix` | Biome: verificar / aplicar correções seguras |
| `pnpm format`, `format:check` | Biome: formatar / verificar |
| `pnpm typecheck` | Verificação de tipos sem emissão |
| `pnpm test:unit` | Unitários (API e web), sem banco nem Docker |
| `pnpm test:contract` | Contrato OpenAPI e schemas |
| `pnpm test:coverage` | Cobertura mínima de 80 % de linhas e 70 % de branches em cada app |
| `pnpm test:e2e` | API via HTTP com providers controlados |
| `pnpm test:integration` | API com PostgreSQL e Redis reais (Testcontainers) |
| `pnpm test:containers [api\|web\|stack]` | Imagens e Compose reais, em projeto, volumes e portas próprios |
| `pnpm check` | Todos os gates acima, em ordem, propagando a falha de cada etapa |

Os comandos de teste não usam cache do Turbo. Os testes de integração e de containers exigem
Docker e falham, em vez de serem ignorados, se ele não estiver disponível.

## Estrutura

```text
apps/api   NestJS: auth, health, orders, cache, docs, common, prisma/
apps/web   React + Vite: app, features/{auth,orders}, components, lib
docs       decisions.md e openapi.json
scripts    check, test:containers e testes dos containers
docker-compose.yml, turbo.json, biome.json, pnpm-workspace.yaml
```

O Turborepo orquestra `build`, `typecheck`, `lint`, `test:*` e `dev` (persistente, sem cache). Migrations,
seed, integração, navegador e containers nunca vêm do cache.

## Limitações conhecidas

- Sem refresh token, cadastro, perfis de acesso ou limite de tentativas de login; todo usuário autenticado vê
  todos os pedidos.
- A lista não é um snapshot único: `count` e página são consultas independentes sob escrita concorrente.
- O PATCH não tem ETag; vale a ordem de efetivação.
- Testes de navegador só em Chromium.
- Nada de deploy, push ou configuração de produção foi feito ou inferido.

Próximos passos honestos: medir o cache antes de afirmar ganho, throttling de login, refresh token, e uma
decisão sobre cache de listagens apenas se houver dado que a justifique.
