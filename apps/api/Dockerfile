# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/api/Dockerfile --target runtime -t naporta-api .
#   docker build -f apps/api/Dockerfile --target migrate -t naporta-api-migrate .
ARG NODE_VERSION=22.22.3

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl lets Prisma pick the right schema engine for this OS; ca-certificates is needed to download it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /repo

# Workspace manifests and the lockfile only: this layer is reused until a dependency changes.
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @naporta/api...

FROM dependencies AS build
COPY apps/api apps/api
# Generates the Prisma client from the schema, then compiles TypeScript. No database is contacted.
RUN pnpm --filter @naporta/api build

# Production dependencies only, resolved from the same frozen lockfile.
FROM build AS production-dependencies
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @naporta/api deploy --legacy --prod /deployed

# One-shot job: applies the versioned migrations and exits. Never part of the API start-up.
FROM dependencies AS migrate
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
WORKDIR /repo/apps/api
USER node
ENV NODE_ENV=production
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=root:root /deployed/node_modules ./node_modules
COPY --from=build --chown=root:root /repo/apps/api/package.json ./package.json
COPY --from=build --chown=root:root /repo/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
