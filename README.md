# Bootstrap da API

## Pré-requisitos

- Node.js 22.22.3 ou superior compatível
- pnpm 10.33.0
- PostgreSQL acessível

## Instalação e ambiente

Copie `.env.example` para `.env` e ajuste `DATABASE_URL` para uma URL PostgreSQL acessível. A conexão é obrigatória durante o startup; sem ela a API não inicia.

Execute, nesta ordem:

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm build
pnpm start:dev
pnpm start:prod
```

## Testes

- `pnpm test` - testes unitários
- `pnpm test:e2e` - testes HTTP sem PostgreSQL real
- `pnpm test:integration` - integração com PostgreSQL real

## Lint

- `pnpm lint` - verifica sem alterar arquivos
- `pnpm lint:fix` - aplica correções Biome, incluindo `--unsafe`; revise o diff antes de aceitar as alterações.

## Prisma

- `pnpm prisma:generate` - gera o client
- `pnpm prisma:validate` - valida o schema
- `pnpm prisma:migrate:dev` - aplica migrations de desenvolvimento

A rota pública `GET /` retorna `Hello World!`.
