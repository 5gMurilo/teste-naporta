# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t naporta-web .
# Runtime configuration: API_UPSTREAM (default http://api:3000) is where /api/ is proxied to.
ARG NODE_VERSION=22.22.3
ARG NGINX_VERSION=1.29

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @naporta/web...

FROM dependencies AS build
COPY apps/web apps/web
# Only the bundle is produced here; type checking and tests are separate gates. Nothing secret can
# reach the bundle: Vite exposes VITE_ variables only, and the one that exists is public.
RUN pnpm --filter @naporta/web exec vite build

FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine AS runtime
ENV API_UPSTREAM=http://api:3000
COPY --from=build --chown=root:root /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/"]
