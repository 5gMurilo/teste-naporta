# Bootstrap da API

## Pré-requisitos

- Node.js 22.22.3 ou superior compatível
- pnpm 10.33.0
- Docker Engine/Desktop com Docker Compose; a primeira integração pode baixar a imagem PostgreSQL

## Instalação e ambiente

Para desenvolvimento local, inicie o banco PostgreSQL persistente:

```sh
docker compose up -d --wait postgres
```

O Compose declara um healthcheck TCP usando `pg_isready`. O healthcheck declara quando o serviço está saudável; `--wait` faz o comando aguardar esse estado. O serviço publica somente em `127.0.0.1:5432` e persiste os dados no volume nomeado `postgres_data`.

Copie `.env.example` para `.env`. A URL local é `postgresql://postgres:postgres@localhost:5432/teste_naporta`. A conexão é obrigatória durante o startup da API; sem ela a API não inicia.

Execute, nesta ordem:

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/api prisma:generate
pnpm --dir apps/api build
pnpm --dir apps/api start:dev
pnpm --dir apps/api start:prod
```

## Testes

- `pnpm --dir apps/api test --runInBand` - testes unitários
- `pnpm --dir apps/api test:e2e --runInBand` - testes HTTP sem PostgreSQL real
- `pnpm --dir apps/api test:integration --runInBand` - integração com PostgreSQL efêmero via Testcontainers; exige Docker acessível, usa uma porta dinâmica e não usa `DATABASE_URL` do ambiente. Execute `pnpm --dir apps/api prisma:generate` antes em um checkout limpo.

As suites unitária e e2e não iniciam containers. A suite de integração falha com diagnóstico se Docker estiver indisponível, sem recorrer a um banco externo.

Para parar o banco local sem remover seus dados, execute `docker compose down`. O volume permanece e os dados voltam quando o serviço for iniciado novamente. Remover o volume é destrutivo e apaga os dados locais.

Se a porta 5432 já estiver ocupada, libere-a ou ajuste explicitamente o mapeamento de porta e a URL local; os testes de integração continuam usando porta dinâmica.

## Lint

- `pnpm lint` - verifica sem alterar arquivos
- `pnpm lint:fix` - aplica correções Biome, incluindo `--unsafe`; revise o diff antes de aceitar as alterações.

## Prisma

- `pnpm --dir apps/api prisma:generate` - gera o client
- `pnpm --dir apps/api prisma:validate` - valida o schema
- `pnpm --dir apps/api prisma:migrate:dev` - aplica migrations de desenvolvimento

A rota pública `GET /` retorna `Hello World!`.
