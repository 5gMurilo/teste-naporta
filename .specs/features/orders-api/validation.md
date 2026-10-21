> Relatório do Verifier independente do ciclo 1, sobre o commit `dc8390c`. As lacunas listadas na seção 6 foram corrigidas e reverificadas em [revalidation.md](revalidation.md) (commit `f8dc0ab`). Mantido como foi produzido.

# naPorta orders API: independent validation (QA-07)

| Item | Value |
| --- | --- |
| Repository | /Users/digitalrepublic/Documents/projetos-pessoais/teste-naporta |
| Branch / commit verified | `feat/naporta-delivery` at `dc8390c82513170f0e46f6e6287b2d049f93a763` ("docs(plan): record delivery stage end commit") |
| Specification | `.specs/features/orders-api/spec.md` (95 IDs in the traceability table), plus `design.md` and `tasks.md` "Execution Protocol" / "Fechamento independente" |
| Date | 2026-10-21 (verification ran 05:15 to 05:42 -03, 08:15 to 08:42 UTC) |
| Environment | macOS 27.0.1 arm64 (Darwin 27.0.0), 8 CPUs; Node v22.22.3; pnpm 10.33.0; Docker 29.8.2 (OrbStack) with Compose v5.5.0; Playwright 1.64.1 Chromium (already installed); host time zone America/Sao_Paulo (-03) |
| Verifier | Independent agent; did not write the code. Commit messages, README, decisions.md and planning status text were treated as claims. |
| Scratch | Two detached worktrees, `/private/tmp/naporta-verify-wt` (gates, probes) and `/private/tmp/naporta-mutate-wt` (mutations, runtime probes), both created from HEAD and removed with `git worktree remove --force` at the end. |

### Real tree before and after

| Check | Before | After |
| --- | --- | --- |
| `git status --porcelain` | empty | empty |
| `git rev-parse HEAD` | dc8390c82513170f0e46f6e6287b2d049f93a763 | dc8390c82513170f0e46f6e6287b2d049f93a763 |
| Branch | feat/naporta-delivery | feat/naporta-delivery |
| `git worktree list` | only the real tree | only the real tree |

Side effect to disclose: Turbo 2.9 shares its local cache across git worktrees ("using shared worktree cache"). During gate run 1 it rewrote four metadata files inside the real tree's ignored `.turbo/cache/` (`6e2b7062555f7f48-manifest.json`, `8966782a50aa018b-manifest.json`, `2081c901784479bd-manifest.json`, `3fad81c2be5ea9b7-manifest.json`, timestamps 05:16:28 to 05:17:56). No tracked or unignored file changed. Every later Turbo invocation used `TURBO_CACHE_DIR=/private/tmp/...`, and a final `find .turbo -newer` showed no further writes. The four files were left in place because every cache entry already had a manifest and deleting them would itself alter the cache.

## 1. Method

1. Read `spec.md` fully, `design.md`, and the protocol parts of `tasks.md`; then the production code and every API, web, contract, integration, E2E and container test referenced below.
2. Ran the project's own gate (`node scripts/check.mjs --keep-going`, i.e. `pnpm check`) twice in a fresh worktree: run 1 as is (Turbo used the shared worktree cache), run 2 with an empty isolated Turbo cache (`TURBO_CACHE_DIR`), which is what a fresh clone sees.
3. Applied 36 behavioural mutations to production code in the second worktree, one at a time, ran the narrowest relevant suites, and restored the file byte for byte (`restored=true` checked after each; `git status --porcelain` empty after the run). Runner: `scratchpad/mutate/run-mutations.mjs`, raw results `scratchpad/mutate/results.jsonl`.
4. Started the compiled API (`apps/api/dist/main.js`) against a disposable `postgres:17-alpine` container created and removed by the verifier (`scratchpad/probe/probe.mjs`, output `scratchpad/probe/probe-run1.log`) to compare running behaviour with the tests.
5. Docker-unavailable behaviour, the Jest/Vitest time-zone mechanism and the web blank-filter case were probed with small throwaway tests in the scratch worktrees (deleted afterwards).

## 2. Gate results

Commands run in `/private/tmp/naporta-verify-wt`. Logs: `scratchpad/check-run1.log`, `scratchpad/check-run2.log`, `scratchpad/install.log`.

| Step | Run 1: shared Turbo cache | Run 2: empty Turbo cache (fresh clone) | Observed counts (run 2 unless stated) |
| --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 (8.9 s) | same install | 882 packages, single root lockfile |
| `playwright install chromium` | exit 0 (already present) | | |
| lint | exit 0 | exit 0 | Biome, both apps |
| format:check | exit 0 | exit 0 | |
| typecheck | exit 0 (Turbo cache hit, not executed) | **exit 2** | 139 `error TS`, e.g. `prisma/seed.ts(6,30): Cannot find module '../src/generated/prisma/client.js'`. After `build` generated the client, `pnpm typecheck` exit 0 |
| test:scripts | exit 0 | exit 0 | 21 tests |
| build | exit 0 (cache hit; Prisma generate **not** run) | exit 0 | |
| test:unit | **exit 1** (20 of 30 API suites "failed to run": `Could not locate module ../../generated/prisma/enums.js`) | exit 0 | API 30 suites / 293 tests + 12 workspace tests; web 21 files / 212 tests |
| test:contract | **exit 1** (9 of 9 suites failed to run, same cause) | exit 0 | 9 suites / 22 tests |
| docs:openapi:check | exit 0 | exit 0 | no drift in `docs/openapi.json` |
| test:coverage | exit 0 | exit 0 | API 89.68 % lines / 81.57 % branches (293 tests); web 99.35 % lines / 93.44 % branches (212 tests) |
| test:e2e (API HTTP) | exit 0 | exit 0 | 1 suite / 1 test |
| test:integration | exit 0 | exit 0 | 17 suites / 121 tests (Testcontainers PostgreSQL 17 + Redis 7) |
| test:e2e:web | exit 0 | exit 0 | 41 Playwright tests |
| test:containers | exit 0 | exit 0 | 3 suites / 24 tests (API image, web image, Compose stack) |
| **`pnpm check` overall** | **exit 1** (3 min 20 s) | **exit 1** (3 min 35 s) | |

Flakiness: none observed. Every step that does not depend on the generated Prisma client passed in both runs; the integration suites were executed about 25 more times during the mutation runs (twice in full for M07/M08) and every failure there was attributable to the applied mutation.

Supplementary: with `DOCKER_HOST=tcp://127.0.0.1:1`, `jest --config test/jest-integration.config.cjs health` exit 1 with "Could not find a working container runtime strategy", and `node scripts/test-containers.mjs api` exit 1 with "Docker is not available. Start Docker (or OrbStack) and run the command again." (`scratchpad/qa04-integration.log`).

## 3. Per-requirement verdicts

Paths are relative to the repository root. "Implementing code" is where the criterion is implemented; "Proving test" is a test whose assertions fail when the behaviour is wrong (mutation IDs in section 4 show which ones were actually checked by breaking the code). Unit = Jest/Vitest without Docker; Integ = Jest + Testcontainers PostgreSQL (and Redis where stated); E2E = Playwright against the real stack; Ctr = container smoke (`scripts/containers`).

| ID | Verdict | Implementing code (file:line) | Proving test (file:line) | Note |
| --- | --- | --- | --- | --- |
| BOOT-01 | PASS | apps/api/package.json:10 (build = prisma generate + tsc), apps/api/tsconfig.json:8 (`strict`), apps/api/prisma/schema.prisma:19-52 | apps/api/test/integration/prisma.integration-spec.ts:22 (compiled ESM client queries PG); scripts/containers/api.test.mjs:85 (compiled image serves health/login) | `pnpm build` exit 0 in both runs. Fresh-clone typecheck ordering problem is reported under OPS-05. |
| BOOT-02 | PASS | apps/api/prisma/migrations/20261021120000_orders_and_users/migration.sql:5-58 | apps/api/test/integration/prisma.integration-spec.ts:48 (uuid/timestamptz/date/jsonb/enum/int4, FK, unique indexes); scripts/containers/api.test.mjs:71 | Email lowercase is enforced by the app (auth.schemas.ts:5-9, seed.ts:245), not by a DB constraint; spec does not require one. |
| BOOT-03 | PASS | apps/api/src/config/env.ts:32-44, 58-74; apps/api/src/main.ts:16-22 | apps/api/src/config/env.spec.ts:41, 45, 86, 153; scripts/containers/api.test.mjs:122 (real image: exits, names DATABASE_URL/JWT_SECRET, prints neither value); scripts/containers/stack.test.mjs:89 | |
| BOOT-04 | PASS | apps/api/src/prisma/prisma.service.ts:17-19; apps/api/src/main.ts:12 | apps/api/src/prisma/prisma.service.spec.ts:49; apps/api/src/application.spec.ts:30 | Process-level SIGTERM exit observed in the runtime probe (API exited, no hang). |
| BOOT-05 | PASS | apps/api/src/health/health.controller.ts:40-47 | apps/api/test/integration/health.integration-spec.ts:30; apps/api/test/integration/guard.integration-spec.ts:48 (exact body against real PG) | |
| BOOT-06 | PASS | apps/api/src/health/health.controller.ts:41-45; problem-details.filter.ts:27 | apps/api/test/integration/health.integration-spec.ts:42; apps/api/src/health/health.controller.spec.ts:26 | The test uses a never-reachable URL, not "stop the DB after startup" (spec I22). Verifier probe stopped a real PostgreSQL under the compiled API: health 503 SERVICE_UNAVAILABLE problem+json in 6 ms. M29 killed. |
| AUTH-01 | PASS | apps/api/src/auth/auth.service.ts:19-31; auth.module.ts:13-20 | apps/api/test/integration/auth.integration-spec.ts:36 (real module token: claims, exp-iat = JWT_EXPIRES_IN) | |
| AUTH-02 | PASS | apps/api/src/auth/auth.service.ts:29 | apps/api/src/auth/auth.service.spec.ts:41 (claim keys exactly aud,email,exp,iat,iss,sub); auth.integration-spec.ts:36 | |
| AUTH-03 | PASS | apps/api/src/auth/auth.service.ts:25-27; domain-errors.ts:18-27 | apps/api/test/integration/auth.integration-spec.ts:59 (identical bodies minus requestId) | |
| AUTH-04 | PARTIAL | apps/api/src/auth/auth.module.ts:21-25; jwt-auth.guard.ts:40-48 | apps/api/src/auth/jwt-auth.guard.spec.ts:80-104 (against a hand-copied config, lines 19-27); apps/api/src/auth/global-guard.http.spec.ts:56 (real module: foreign secret, wrong aud, expired; kills M09) | Runtime is correct (probe: wrong/missing issuer, wrong aud, expired, HS384, HS512, bad signature, alg none all 401 against the compiled API). But no test exercises the production issuer/algorithm options: M07 (drop `algorithms`) and M08 (drop `issuer`) survived 293 unit + 22 contract + 121 integration tests. |
| AUTH-05 | PASS | apps/api/src/common/decorators/public.decorator.ts:5; auth.controller.ts:27; health.controller.ts:7; jwt-auth.guard.ts:33-37 | apps/api/src/auth/global-guard.http.spec.ts:79; public.decorator.spec.ts:33 | M10 killed. |
| AUTH-06 | PASS | apps/api/src/auth/auth.module.ts:30 (APP_GUARD); app.controller.ts:5-11 | apps/api/src/auth/global-guard.http.spec.ts:44; test/integration/guard.integration-spec.ts:34; orders-*.integration-spec 401 cases (e.g. orders-create:98) | M11 killed. |
| AUTH-07 | PASS | no owner filter: apps/api/src/orders/orders.repository.ts:48-53, 136-142 | apps/api/test/integration/orders-detail.integration-spec.ts:114; guard.integration-spec.ts:34 | |
| AUTH-08 | PASS | apps/api/src/auth/auth.service.ts:3, 26; apps/api/prisma/seed.ts:243-246 | apps/api/test/integration/seed.integration-spec.ts:19, 55 (argon2.verify of stored hash; plaintext absent from output) | |
| ORDER-01 | PASS | apps/api/src/orders/orders.controller.ts:121-128; orders.repository.ts:27-42 | apps/api/test/integration/orders-create.integration-spec.ts:28 | |
| ORDER-02 | PASS | apps/api/src/orders/orders.service.ts:26; schema.prisma:30 | orders-create.integration-spec.ts:28 (stored PENDING); apps/api/src/orders/orders.service.spec.ts:37 | M25 killed. |
| ORDER-03 | PASS | apps/api/src/orders/dto/order.presenter.ts:21-39; orders.projections.ts:13-24 | apps/api/test/integration/orders-detail.integration-spec.ts:31 (exact key set, no cacheRevision/deletedAt/orderId) | |
| ORDER-04 | PASS | apps/api/src/orders/dto/order.presenter.ts:35 | orders-detail.integration-spec.ts:31 (4990); order.presenter.spec.ts:38 | |
| ORDER-05 | PASS | apps/api/src/orders/orders.repository.ts:107 | apps/api/test/integration/orders-patch.integration-spec.ts:34 (items and ids equal after status-only PATCHes) | |
| ORDER-06 | PASS | apps/api/src/orders/orders.repository.ts:86-121 | orders-patch.integration-spec.ts:53, 159 (no orphans, never mixed under concurrency), 90 | M24 killed. |
| ORDER-07 | PASS | apps/api/src/orders/orders.repository.ts:97-101 | orders-patch.integration-spec.ts:53 (address without stale complement, other fields kept) | |
| ORDER-08 | PASS | no transition guard: apps/api/src/orders/orders.repository.ts:93 | orders-patch.integration-spec.ts:34 (SHIPPED->PENDING->CANCELED->DELIVERED->...) | |
| ORDER-09 | PASS | apps/api/src/orders/orders.repository.ts:127-133; orders.controller.ts:332 | apps/api/test/integration/orders-delete.integration-spec.ts:35 (empty body, rows kept, deletedAt set) | Probe on compiled API: 204, 0 bytes, items kept. |
| ORDER-10 | PASS | apps/api/src/orders/orders.service.ts:34, 56, 65; orders.repository.ts:105 | orders-detail.integration-spec.ts:83; orders-patch.integration-spec.ts:211; orders-delete.integration-spec.ts:52, 80 | M01, M02 killed. |
| ORDER-11 | PASS | migration.sql:49; prisma-error.mapper.ts:18-27 | orders-create.integration-spec.ts:123, 135; orders-patch.integration-spec.ts:129, 146 | |
| ORDER-12 | PASS | apps/api/src/orders/orders.repository.ts:27-42 (nested write), 86-121 (one transaction) | orders-create.integration-spec.ts:143; orders-patch.integration-spec.ts:90 (DB trigger failure, state read on a fresh connection) | M24 killed. |
| ORDER-13 | PASS | apps/api/src/orders/orders.repository.ts:89-105, 127-133 | orders-patch.integration-spec.ts:176 (row lock barrier, no sleeps); orders-delete.integration-spec.ts:88, 109 | M01, M02 killed by these. |
| ORDER-14 | PARTIAL | apps/api/src/orders/orders.repository.ts:32, 95; schemas/orders.schemas.ts:21-23; dto/order.presenter.ts:6-8 | orders-detail.integration-spec.ts:58; orders-create.integration-spec.ts:53; order.presenter.spec.ts:91 (all switch zones with `process.env.TZ = zone` inside Jest) | Behaviour is correct: the verifier started the compiled API with TZ=America/Sao_Paulo, Pacific/Kiritimati and Pacific/Pago_Pago and got `2026-11-03` in the POST body, the DB column, the detail and the list; the date suites also pass unmutated with TZ=Kiritimati/Pago_Pago/UTC set at process start. But the tests' zone switch is a no-op under Jest (probe: offset stays 180 and `resolvedOptions().timeZone` stays America/Sao_Paulo for 'UTC' and 'Pacific/Kiritimati'), so every 'TZ=...' case runs in the host zone. M19 (write DATE from local midnight) survived the project's suites and was killed (5 failures) only when the verifier set TZ=Pacific/Kiritimati for the whole process. |
| ORDER-15 | PASS | apps/api/src/orders/dto/order.presenter.ts:35 | orders-detail.integration-spec.ts:58; orders-create.integration-spec.ts:82 | M20 killed. |
| LIST-01 | PASS | apps/api/src/orders/schemas/orders.schemas.ts:164-170 | apps/api/test/integration/orders-list.integration-spec.ts:41 | |
| LIST-02 | PASS | apps/api/src/orders/orders.repository.ts:57-67 | orders-list.integration-spec.ts:53, 67, 102 (soft-deleted omitted) | |
| LIST-03 | PASS | schemas/orders.schemas.ts:21-30, 166-167; orders.repository.ts:61-66 | orders-list.integration-spec.ts:83 (23:59:59.999Z of day 20 and 00:00Z of day 22 excluded) | M12 killed. |
| LIST-04 | PASS | apps/api/src/orders/orders.repository.ts:72 | orders-list.integration-spec.ts:102 | M13 killed. |
| LIST-05 | PASS | orders.repository.ts:68-77; dto/order.presenter.ts:49 | orders-list.integration-spec.ts:122, 141; order.presenter.spec.ts:143 | M21, M22 killed. |
| LIST-06 | PASS | orders.projections.ts:3-11; orders.repository.ts:69-75 | apps/api/src/orders/orders.repository.spec.ts:84; orders-list.integration-spec.ts:41 (summary keys only) | |
| LIST-07 | PASS | schemas/orders.schemas.ts:144; orders.repository.ts:59 | orders-list.integration-spec.ts:53 | |
| VAL-01 | PARTIAL | apps/api/src/orders/schemas/orders.schemas.ts:36-82; validation.exception.ts:39-43 | apps/api/src/orders/schemas/orders.schemas.spec.ts:42-116, 188-211; orders-create.integration-spec.ts:105; orders-list.integration-spec.ts:150 | Minimums and "one above the maximum" are tested, but acceptance at the maximum is not tested for customer.name (160), street (160), number (20), neighborhood (100), city (100) or item description (240). M26 (name 160->159) and M27 (description 240->239) passed all 293 unit tests and the 35 create/patch integration tests; they were caught only by the byte comparison with the committed docs/openapi.json (openapi.contract-spec.ts:102), which a regenerated document would silence. |
| VAL-02 | PASS | schemas/orders.schemas.ts:41, 48, 69, 85, 116, 130, 143 (strictObject) | orders.schemas.spec.ts:87-88, 110-111; orders-create.integration-spec.ts:105; orders-list.integration-spec.ts:150 ('unknown filter') | |
| VAL-03 | PASS | schemas/orders.schemas.ts:36, 54-59 | orders-create.integration-spec.ts:53 (persisted `NP-TRIM`, `SP`, `Santos`) | M15, M16 killed. |
| VAL-04 | PASS | schemas/orders.schemas.ts:80, 124, 156-159 | orders-patch.integration-spec.ts:222; orders-list.integration-spec.ts:150 ('inverted period') | |
| VAL-05 | PASS | schemas/orders.schemas.ts:15-18, 43 | orders-create.integration-spec.ts:82 (2000-01-01, document `ABC`) | |
| VAL-06 | PASS | schemas/orders.schemas.ts:4-18 | orders-create.integration-spec.ts:105; orders-patch.integration-spec.ts:222; orders-list.integration-spec.ts:150 | |
| ERR-01 | PASS | apps/api/src/common/errors/problem-details.filter.ts:24-34, 95-108 | problem-details.filter.spec.ts:25, 65, 89, 114; orders-detail.integration-spec.ts:83; health.integration-spec.ts:42 | All matrix conditions answer the matrix code. Non-matrix 413 is covered under ERR-08. |
| ERR-02 | PASS | apps/api/src/common/errors/validation.exception.ts:32-43 | apps/api/src/common/errors/problem-details.filter.spec.ts:25 (sentinels not echoed) ; auth.integration-spec.ts:71 | |
| ERR-03 | PASS | apps/api/src/common/errors/prisma-error.mapper.ts:4-27 | apps/api/test/integration/prisma-error.integration-spec.ts:26 (real create/update/soft-deleted) | M06 killed. |
| ERR-04 | PASS | prisma-error.mapper.ts:22 | prisma-error.integration-spec.ts:44 (real duplicate email stays P2002); problem-details.integration-spec.ts:72 (real FK violation -> 500) | M06 killed. |
| ERR-05 | PASS | problem-details.filter.ts:30-34, 64 | problem-details.filter.spec.ts:114; orders-create.integration-spec.ts:143 (no trigger/SQL text) | Probe: 500 bodies generic for a contract-breaking JSONB row and with PostgreSQL stopped. |
| ERR-06 | PASS | problem-details.filter.ts:79-89 | problem-details.filter.spec.ts:114 (exact log object, sentinels absent); problem-details.integration-spec.ts:72 | Log line is Nest ConsoleLogger text with ANSI colour codes wrapping the JSON (seen in probe output, NODE_ENV=production), and carries no error class: parseable only after stripping. |
| ERR-07 | PASS | apps/api/src/common/http/request-id.middleware.ts:8-17; problem-details.filter.ts:76, 106 | request-id.middleware.spec.ts:25, 34, 56; health.integration-spec.ts:42 | Probe: header present on 200 too. |
| ERR-08 | PARTIAL | problem-details.filter.ts:40-65 | problem-details.filter.spec.ts:76 (403 and route 404 keep status) | Only Nest `HttpException`s keep their status. A body-parser `PayloadTooLargeError` (http-errors 413) is not one, and Nest maps only SyntaxError/URIError (platform-express express-adapter.js `mapException`). Probe: POST of a ~200 KB JSON body answered **500 INTERNAL_SERVER_ERROR** and logged `request_failed status 500`; the spec's assumption table requires 413 to be preserved. No test sends an oversized body. |
| DOC-01 | PASS | apps/api/src/docs/openapi.ts:18-30 | apps/api/test/contract/openapi.contract-spec.ts:49, 129 | |
| DOC-02 | PASS | order.responses.ts, orders.schemas.ts, auth.schemas.ts (`.meta({ id })`), problem-details.dto.ts | openapi.contract-spec.ts:63; orders-create.contract-spec.ts:20; orders-list.contract-spec.ts:35; orders-patch.contract-spec.ts:19 | All nine names present in docs/openapi.json (checked with node). |
| DOC-03 | PARTIAL | schemas exported through `standardSchema` / `@Body({schema})` | orders-schemas.contract-spec.ts:27, 45; orders-patch.contract-spec.ts:19 | Gaps in docs/openapi.json: UpdateOrderRequest has no `minProperties` or schema text for "at least one field" (only the 400 description mentions it); `DeliveryAddress.state` pattern `^[A-Z]{2}$` and `LoginRequest.email` pattern reject `sp` / `  Demo@X.com ` that the runtime accepts and normalizes; page/pageSize limits and defaults only in prose; real-calendar date rule not stated. The design asked the contract test to check "PATCH não vazio"; it asserts the opposite (`required` empty) only. |
| DOC-04 | PASS | orders.controller.ts:60-120, 331-392; health.controller.ts:28-39 | orders-create.contract-spec.ts:30 (Location); orders-delete.contract-spec.ts:15 (204 no content); orders-patch.contract-spec.ts:28 | |
| DOC-05 | PASS | apps/api/src/docs/export-openapi.ts:9-28; openapi.ts:6-16 | openapi.contract-spec.ts:88, 102; `pnpm docs:openapi:check` exit 0 | |
| DOC-06 | PASS | README.md (sections at lines 26-247); docs/decisions.md | scripts/docs.test.mjs:18, 115 | The documented "install then check" flow fails on a fresh clone; see OPS-05. |
| OPS-01 | PASS | docker-compose.yml:8-23, 105-106 | scripts/containers/stack.test.mjs:111 (loopback only), 195 (volume survives down/up) | |
| OPS-02 | PASS | apps/api/prisma/seed.ts:240-274 | apps/api/test/integration/seed.integration-spec.ts:19 | |
| OPS-03 | PASS | seed.ts:254-259 | seed.integration-spec.ts:55 (external and soft-deleted reserved orders unchanged) | |
| OPS-04 | PASS | apps/api/src/main.ts:9-14 (no seed); .gitignore:7; .env.example:6 (empty JWT_SECRET) | scripts/containers/stack.test.mjs:127; scripts/containers/api.test.mjs:57, 85 | |
| OPS-05 | PARTIAL | package.json:5-30; turbo.json:4-14 | scripts/check.test.mjs:109 (scripts exist); apps/api/test/workspace/turbo-graph.test.mjs:24 | Reproduced: after the documented `pnpm install --frozen-lockfile` (README.md:33-35) the Prisma client is not generated, and `typecheck` has no dependency on generation (turbo.json:11-14). Fresh worktree + empty Turbo cache: `pnpm check` -> typecheck exit 2 (139 TS errors, `Cannot find module '../src/generated/prisma/client.js'`). With a warm Turbo cache, `build` is a cache hit that restores only `dist/**` (turbo.json:7), so `src/generated` stays missing and `test:unit` (20 suites) and `test:contract` (9 suites) fail with "Could not locate module ../../generated/prisma/enums.js". The workspace test pins this graph (turbo-graph.test.mjs:31, 33). |
| QA-01 | PASS | apps/api/test/helpers/postgres-test-context.ts:54-108; test/integration/setup.ts:11-21 | apps/api/test/integration/prisma.integration-spec.ts:6, 48 | |
| QA-02 | PASS | postgres-test-context.ts:35-43; setup.ts:15-17; redis-test-context.ts:22-33 | prisma.integration-spec.ts:102, 115; redis.integration-spec.ts:75; apps/web/test/e2e/stack.spec.ts:69 | |
| QA-03 | PASS | postgres-test-context.ts:99-116; redis-test-context.ts:62-78; apps/web/test/e2e/support/stack.ts:36-95 | apps/api/test/helpers/postgres-test-context.spec.ts:59; redis-test-context.spec.ts:52; apps/web/test/unit/stack.test.ts:97, 113 | |
| QA-04 | PASS | postgres-test-context.ts:70-80 (no fallback); scripts/test-containers.mjs:21-25 | postgres-test-context.spec.ts:78 | Verifier run with DOCKER_HOST=tcp://127.0.0.1:1: integration exit 1 "Could not find a working container runtime strategy" (plus a secondary `Cannot read properties of undefined (reading 'reset')`); `test:containers api` exit 1 "Docker is not available". |
| QA-05 | PASS | apps/api/jest.config.cjs:5-13; apps/web/vite.config.ts:22-36 | scripts/check.test.mjs:103; turbo-graph.test.mjs:103 | Measured: API 89.68 % lines / 81.57 % branches; web 99.35 % / 93.44 %. Thresholds are global per app; `apps/api/src/orders` alone is 78.08 % lines (orders.controller.ts 55.55 %, only exercised by integration tests, which do not count). |
| QA-06 | PASS | scripts/lib/run-steps.mjs:8-22, 37-56 | scripts/check.test.mjs:13, 37, 59, 82 | Structure and failure propagation verified (both verifier runs exited 1 on a failing step). That the gate cannot pass on a fresh clone is recorded under OPS-05. |
| QA-07 | see section 7 | this report | | |
| QA-08 | PASS | apps/api/test/helpers/redis-test-context.ts:39-80 | orders-detail-cache-http.integration-spec.ts:53, 82; orders-patch-cache.integration-spec.ts:51, 113; orders-detail-cache.integration-spec.ts:87; redis.integration-spec.ts:95 | Failure injection uses `jest.spyOn` on `RedisService.del` / `cache.put` at the boundary (allowed by the spec); reads use the real Redis and PostgreSQL. |
| QA-09 | PASS | apps/web/test/e2e/support/stack.ts:36-95; default-steps.ts | apps/web/test/e2e/delete-order.spec.ts:18 (create, find, open, edit, delete, 404) | 41 Playwright tests passed in both runs. |
| CACHE-01 | PASS | apps/api/src/orders/orders-detail.reader.ts:28-31; orders-detail.cache.ts:65-72; config/env.ts:41 | orders-detail-cache-http.integration-spec.ts:53 (TTL 0<t<=60); orders-detail-cache.integration-spec.ts:87 (short TTL expires); apps/api/src/config/env.spec.ts:14 (default 60) | M31 killed. |
| CACHE-02 | PASS | orders-detail.reader.ts:21-24; orders.repository.ts:136-142 | orders-detail-cache-http.integration-spec.ts:53 (snapshot loaded once for miss+hit, identical bodies) | M03 killed. |
| CACHE-03 | PASS | apps/api/src/orders/orders.service.ts:49-51, 57-59 | orders-patch-cache.integration-spec.ts:51, 71 (rollback keeps entry), 95; orders-delete-cache.integration-spec.ts:50, 124 | M04, M05 killed. |
| CACHE-04 | PASS | apps/api/src/cache/redis.service.ts:97-111; cache.module.ts:15-24; orders-detail.cache.ts:42-56 | redis.integration-spec.ts:82, 95, 124; orders-detail-cache-http.integration-spec.ts:133, 175; scripts/containers/stack.test.mjs:166 (Redis stopped: 200 in < 3 s) | |
| CACHE-05 | PASS | orders-detail.reader.ts:20-32; orders.repository.ts:102, 130 | orders-detail-cache-http.integration-spec.ts:82, 110; orders-delete-cache.integration-spec.ts:75, 90; orders-patch-cache.integration-spec.ts:113 | M03, M23 killed. |
| CACHE-06 | PASS | only caller of `put`: orders-detail.reader.ts:30 | orders-detail-cache-http.integration-spec.ts:121 (no keys after 404, list, login); orders-delete-cache.integration-spec.ts:50 | |
| CACHE-07 | PASS | orders-detail.cache.ts:7, 10-13, 67-68 | orders-detail.cache.spec.ts:43; orders-detail-cache.integration-spec.ts:111; orders-detail-cache-http.integration-spec.ts:53 (`revision` stored, not in `data`) | |
| CACHE-08 | PASS | orders-detail.cache.ts:28-37, 44-61; redis.service.ts:69-71 | orders-detail-cache-http.integration-spec.ts:145; redis.integration-spec.ts:141; orders-detail.cache.spec.ts:136 | Counters are in-memory provider state only (no endpoint, as the spec allows). |
| WEB-01 | PASS | apps/web/package.json:9-19; apps/web/tsconfig.json:8; apps/web/components.json:4 (`rsc: false`); apps/web/Dockerfile:27-31 (static nginx) | scripts/containers/web.test.mjs:45, 136; apps/web/test/unit/workspace.test.ts:17 | |
| WEB-02 | PASS | apps/web/src/features/auth/session-provider.tsx:39-85 | session-provider.test.tsx:66; apps/web/test/e2e/login.spec.ts:12 (URL and storage checked) | |
| WEB-03 | PASS | apps/web/src/lib/http-client.ts:141-145; session-provider.tsx:45-51, 56; app/protected-route.tsx:5-11 | session-provider.test.tsx:105, 122; login-page.test.tsx:145; apps/web/test/e2e/orders-list.spec.ts:102 | W02, W03 killed. |
| WEB-04 | PARTIAL | apps/web/src/features/orders/orders-list-page.tsx:23-45, 75-86; orders-filters.tsx:36-44; lib/http-client.ts:68-75 | orders-list-page.test.tsx:69, 112; apps/web/test/e2e/orders-list.spec.ts:12, 47 | Contract queries, meta and page reset are correct. A whitespace-only "Número do pedido" is sent as `orderNumber=%20%20%20` (filters are not trimmed, http-client.ts:71 omits only `''`); the API answers 400 (orders-list.integration-spec.ts:163) and the list shows an error. Confirmed with a throwaway Vitest probe in the scratch worktree (request carried `orderNumber`). Page reset itself is protected: W04 killed. |
| WEB-05 | PASS | apps/web/src/features/orders/order-form-model.ts:86-91, 159-168; create-order-page.tsx:14-20 | create-order-page.test.tsx:68, 145, 170; order-form-model.test.ts:45, 94; apps/web/test/e2e/create-order.spec.ts:11 | |
| WEB-06 | PASS | apps/web/src/lib/format.ts:5-8, 32-36; order-detail-page.tsx | order-detail-page.test.tsx:39, 56, 154; format.test.ts:19; apps/web/test/e2e/order-detail.spec.ts:13, 75 | W05 killed. |
| WEB-07 | PASS | order-form-model.ts:177-192; edit-order-page.tsx:21-27 | order-form-model.test.ts:153-226; edit-order-page.test.tsx:86, 104, 125; apps/web/test/e2e/edit-order.spec.ts:11, 37 | W01 killed. |
| WEB-08 | PASS | apps/web/src/features/orders/delete-order-dialog.tsx:38-57, 85 | delete-order-dialog.test.tsx:75, 100, 125; apps/web/test/e2e/delete-order.spec.ts:60, 78 | |
| WEB-09 | PASS | apps/web/src/components/async-state.tsx | async-state.test.tsx:11, 23, 43; orders-list-page.test.tsx:139, 151; apps/web/test/e2e/orders-list.spec.ts:5, 69 | |
| WEB-10 | PASS | components/form-field.tsx; order-form.tsx:151-211; login-page.tsx:118-156 | order-form.test.tsx:108, 200; login-page.test.tsx:122, 168; apps/web/test/e2e/login.spec.ts:60 (390 and 1280 px, no horizontal scroll); delete-order.spec.ts:166 | |
| MONO-01 | PASS | pnpm-workspace.yaml:1-2; single pnpm-lock.yaml | apps/api/test/workspace/turbo-graph.test.mjs:75 | `pnpm install --frozen-lockfile` exit 0 in two fresh worktrees. |
| MONO-02 | PASS | package.json:5-14; turbo.json:4-14, 32 | turbo-graph.test.mjs:14, 36, 54, 83 | Turbo orchestrates both apps; the missing generate dependency is reported under OPS-05. |
| MONO-03 | PASS | turbo.json:15-31 (cache false); package.json:28 (db:seed outside Turbo) | turbo-graph.test.mjs:94; scripts/check.test.mjs:88 | Log of run 2: every test/integration/e2e task "cache bypass, force executing". |
| PACK-01 | PASS | apps/api/Dockerfile:7-61; apps/web/Dockerfile:8-34; .dockerignore:2-15 | scripts/containers/api.test.mjs:38, 48, 57; web.test.mjs:45 | |
| PACK-02 | PASS | docker-compose.yml:36-87 | scripts/containers/stack.test.mjs:99 (migrate exit 0 and finished before the API started), 132 | |
| PACK-03 | PASS | apps/web/nginx/default.conf.template:17-54 | scripts/containers/web.test.mjs:75, 88, 106; stack.test.mjs:147 | |
| PACK-04 | PASS | docker-compose.yml:16-17, 26-33 | scripts/containers/stack.test.mjs:166, 195 | |

**Totals: 87 PASS, 7 PARTIAL (AUTH-04, ORDER-14, VAL-01, ERR-08, DOC-03, OPS-05, WEB-04), 0 FAIL, QA-07 judged in section 7.**

Edge Cases table of the spec: every row has at least one test (same number after DELETE: orders-delete.integration-spec.ts:67, orders-patch.integration-spec.ts:129; second delete/read/edit: orders-delete:52; items omitted vs present: orders-patch:34, 53; complement omitted: orders-patch:53; failure mid replacement: orders-patch:90; DELETE wins: orders-patch:176; 23:59:59.999Z / next 00:00Z: orders-list:83; tie: orders-list:102; page past end and total 0: orders-list:122, 141; total above INTEGER: orders-detail:58; seed with sentinel: seed:55; exception with SQL/password sentinel: problem-details.filter.spec.ts:114; late repopulation: orders-detail-cache-http:82, orders-delete-cache:90; Redis down during write: orders-patch-cache:113, orders-delete-cache:75, stack.test.mjs:166; login then reload: e2e login.spec.ts:12; deep link on the web host: web.test.mjs:75, stack.test.mjs:147). The "different process time zones" proofs exist but do not switch zones (ORDER-14).

## 4. Discrimination sensor (mutation testing)

Worktree `/private/tmp/naporta-mutate-wt`. Commands run from `apps/api` as `NODE_OPTIONS=--experimental-vm-modules pnpm exec jest --config <cfg> --runInBand <pattern>` (unit = `jest.config.cjs`, integ = `test/jest-integration.config.cjs`, contract = `test/jest-contract.config.cjs`; no pattern = whole suite) and from `apps/web` as `pnpm exec vitest run <path>`. Each mutation was reverted before the next.

| ID | Mutation (production file:line) | Command(s) | Result | Killing test(s) |
| --- | --- | --- | --- | --- |
| M01 | PATCH `updateMany` where `{ id, deletedAt: null }` -> `{ id }` (orders.repository.ts:90) | unit orders.patch.spec; integ orders-patch | KILLED (2 + 2 failed) | orders-patch.integration-spec.ts:176 (I15), :211 |
| M02 | DELETE where `{ id, deletedAt: null }` -> `{ id }` (orders.repository.ts:129) | unit orders.delete.spec; integ orders-delete | KILLED (1 + 2) | orders-delete.integration-spec.ts:52, :109 |
| M03 | Cache revision comparison removed (orders-detail.cache.ts:57) | unit orders-detail.cache.spec; integ *-cache | KILLED (1 + 2) | orders-detail-cache-http:82 (I29), orders-patch-cache:113 (I28) |
| M04 | PATCH no longer invalidates after commit (orders.service.ts:51) | unit orders.invalidation.spec; integ orders-patch-cache | KILLED (1 + 2) | orders-patch-cache:51 (I25), :113 |
| M05 | PATCH invalidates before the transaction, not after commit (orders.service.ts:45, 51) | same | KILLED (4 + 1) | orders-patch-cache:71 (rollback keeps entry) |
| M06 | Any P2002 mapped to ORDER_NUMBER_ALREADY_EXISTS (prisma-error.mapper.ts:22) | unit src/common/errors; integ prisma-error | KILLED (2 + 1) | prisma-error.integration-spec.ts:44 (real duplicate email) |
| M07 | `algorithms: ['HS256']` removed from AuthModule verifyOptions (auth.module.ts:22) | unit (all 293); contract (22); integ (all 121) | **SURVIVED** | none; HS384/HS512 tokens with the same secret would be accepted |
| M08 | `issuer` removed from AuthModule verifyOptions (auth.module.ts:23) | unit (all); contract (all); integ (all) | **SURVIVED** | none; tokens with any or no `iss` would be accepted |
| M09 | `audience` removed from AuthModule verifyOptions (auth.module.ts:24) | unit src/auth | KILLED (1) | global-guard.http.spec.ts:56 |
| M10 | Guard reads `@Public` only from the handler (jwt-auth.guard.ts:33-36) | unit src/auth | KILLED (2) | global-guard.http.spec.ts:79; jwt-auth.guard.spec.ts:73 |
| M11 | Guard bypass unless metadata is explicitly false (jwt-auth.guard.ts:37) | unit jwt-auth.guard.spec | KILLED (16) | jwt-auth.guard.spec.ts:80-104 |
| M12 | createdTo bound `lt` -> `lte` (orders.repository.ts:64) | unit orders.repository.spec; integ orders-list | KILLED (2 + 1) | orders-list.integration-spec.ts:83 (I17) |
| M13 | Sort tie-break `id DESC` removed (orders.repository.ts:72) | same | KILLED (1 + 1) | orders-list.integration-spec.ts:102 |
| M14 | pageSize max 100 -> 101 (orders.schemas.ts:152) | unit schemas; integ orders-list | KILLED (1 + 1) | orders.schemas.spec.ts "pageSize 101"; orders-list:150 |
| M15 | state no longer uppercased (orders.schemas.ts:57-58) | unit schemas; integ orders-create | KILLED (1 + 1) | orders-create.integration-spec.ts:53 (persisted `SP`) |
| M16 | state no longer trimmed (orders.schemas.ts:56) | same | KILLED (1 + 1) | orders.schemas.spec.ts:27; orders-create:53 |
| M17 | items max 50 -> 51 (orders.schemas.ts:80) | unit schemas | KILLED (1) | orders.schemas.spec.ts "fifty one items" |
| M18 | Presenter formats DATE in the host zone (order.presenter.ts:7) | unit src/orders/dto; integ orders-detail | KILLED (4 + 3) | order.presenter.spec.ts:91; orders-detail:58 (note: also the case labelled "TZ=UTC" failed, because the zone never changes) |
| M19 | Create writes DATE from local midnight, `new Date('YYYY-MM-DDT00:00:00')` (orders.repository.ts:32) | unit src/orders (140); integ orders-(create\|detail) (26) | **SURVIVED** | none in the project's configuration. Re-run with `TZ=Pacific/Kiritimati` for the whole process: KILLED (5 failed, orders-detail:58 x3, orders-create:28, :53) |
| M20 | Total with 32-bit arithmetic `(t + p) \| 0` (order.presenter.ts:35) | unit dto; integ orders-detail | KILLED (1 + 3) | order.presenter.spec.ts:81; orders-detail:58 |
| M21 | `totalPages` with `Math.round` (order.presenter.ts:49) | unit dto | KILLED (3) | order.presenter.spec.ts:143 |
| M22 | `count` ignores the filters (orders.repository.ts:76) | unit repository; integ orders-list | KILLED (1 + 2) | orders-list.integration-spec.ts:53, :67 |
| M23 | Reader caches under the pre-check revision (orders-detail.reader.ts:30) | unit orders-detail.reader.spec | KILLED (1) | orders-detail.reader.spec.ts:99 |
| M24 | PATCH item writes outside the transaction (orders.repository.ts:108-109) | integ orders-patch | KILLED (1) | orders-patch.integration-spec.ts:90 (I12) |
| M25 | Default status PENDING -> PROCESSING (orders.service.ts:26) | unit orders.service.spec | KILLED (1) | orders.service.spec.ts:37 |
| M26 | customer.name max 160 -> 159 (orders.schemas.ts:42) | unit (all 293: pass); contract; integ create/patch (35: pass) | KILLED, weakly | only openapi.contract-spec.ts:102 (byte equality with committed docs/openapi.json) |
| M27 | item description max 240 -> 239 (orders.schemas.ts:70) | same | KILLED, weakly | only openapi.contract-spec.ts:102 |
| M28 | Problem `instance` keeps the query string (problem-details.filter.ts:37) | unit src/common; integ problem-details\|orders-detail | KILLED (2 unit; integ passed) | problem-details.filter.spec.ts:25, :114 |
| M29 | Health failure -> plain Error (500) instead of 503 (health.controller.ts:44) | unit src/health; integ health | KILLED (2 + 1) | health.integration-spec.ts:42 |
| M30 | Login email no longer lowercased (auth.schemas.ts:8) | unit src/auth; integ auth | KILLED (1 + 1) | auth.integration-spec.ts:36 |
| M31 | Default CACHE_TTL_SECONDS 60 -> 600 (env.ts:41) | unit src/config\|src/cache; integ orders-detail-cache-http | KILLED (1 + 1) | env.spec.ts:14; orders-detail-cache-http:53 |
| W01 | Web PATCH always sends `customer` (order-form-model.ts:187) | vitest src/features/orders | KILLED (14) | order-form-model.test.ts:153-226; order-form.test.tsx:243, 254 |
| W02 | Web ignores 401 on protected calls (http-client.ts:143) | vitest http-client.test; src/features/auth | KILLED (1 + 3) | http-client.test.ts:147; session-provider.test.tsx:105 |
| W03 | Web treats any 401, including wrong password, as expired session (http-client.ts:143) | same | KILLED (1 + 2) | http-client.test.ts:155; session-provider.test.tsx:122 |
| W04 | List no longer resets to page 1 when filters change (orders-list-page.tsx:80) | vitest orders-list-page.test | KILLED (1) | orders-list-page.test.tsx:69 |
| W05 | BRL formatting through float division (format.ts:33-35) | vitest format.test; order-detail-page.test | KILLED (3 + 1) | format.test.ts; order-detail-page.test.tsx:56 |

**Score: 33 of 36 killed (91.7 %); 31 of 36 (86.1 %) if the two kills that come only from the committed-OpenAPI byte comparison are not counted.** Survivors: M07, M08, M19. Every requested category was covered: soft delete in PATCH/DELETE (M01, M02), revision comparison (M03), invalidation after commit (M04, M05), orderNumber mapping (M06), JWT algorithm/issuer/audience (M07-M09), public bypass (M10, M11), createdTo exclusive bound (M12), tie-break (M13), pageSize limit (M14), state trim/uppercase (M15, M16), 50-item limit (M17), civil DATE (M18, M19), total (M20), web PATCH diff and 401 handling (W01-W03).

Supporting probes (scratch only, deleted afterwards):

- Jest time zone: a spec setting `process.env.TZ` to 'UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago' printed `offsetMin=180 resolved=America/Sao_Paulo` every time; the same spec run with `TZ=Pacific/Kiritimati` in the process environment printed `offsetMin=-840`. Plain `node -e` honours the runtime change (-840), so the no-op is specific to the Jest ESM sandbox.
- Vitest time zone: the same switch is effective there (`offset=0 resolved=UTC`, then `offset=-840 resolved=Pacific/Kiritimati`), so the web zone tests are valid.
- Unmutated date suites with the zone set at process start: `TZ=Pacific/Kiritimati`, `Pacific/Pago_Pago`, `UTC` each gave integration orders-(create|detail|list) 47/47 and unit src/orders 140/140.

## 5. Runtime probes against the compiled API (part D)

`node scratchpad/probe/probe.mjs` started `apps/api/dist/main.js` (NODE_ENV=production, REDIS_URL unreachable) on a verifier-owned `postgres:17-alpine` container after `prisma migrate deploy`. Exit 0; the container was removed. Results (`scratchpad/probe/probe-run1.log`):

| Probe | Observed | Matches spec |
| --- | --- | --- |
| POST/GET/list with API started under TZ=America/Sao_Paulo, Pacific/Kiritimati, Pacific/Pago_Pago | body, DB (`expectedDeliveryDate::text`), detail, list all `2026-11-03` | yes (ORDER-14) |
| Tokens with wrong issuer, missing issuer, wrong audience, expired, HS384 and HS512 with the right secret, wrong secret, `alg: none` | 401 UNAUTHORIZED each; valid token 200 | yes (AUTH-04 runtime) |
| X-Request-Id on a 200 | UUID present | yes (ERR-07) |
| Malformed JSON, `text/plain` body, `[]` body | 400 VALIDATION_ERROR problem+json | yes |
| **~200 KB JSON body** | **500 INTERNAL_SERVER_ERROR** problem+json, and an `request_failed` 500 log line | **no** (ERR-08: 413 must be preserved) |
| Unknown route, PUT on an order | 404 HTTP_ERROR, requestId equals header | yes (ERR-08) |
| DELETE | 204, 0 bytes, no content-type; items still in DB | yes (ORDER-09) |
| `?page=1&page=2`, repeated status, `page=99999999999999999999`, `page[a]=1`, 65-char orderNumber | 400 | yes. (`?pageSize=100&page=21474837` answered 200: skip 2 147 483 600 is inside the documented bound; the probe's expectation was wrong, not the API.) |
| Row whose JSONB address breaks the contract, read with `?token=SECRET-QUERY` | 500 generic body; log has no document, query or token sentinels | yes (ERR-05, ERR-06) |
| PostgreSQL container stopped after startup | health 503 SERVICE_UNAVAILABLE problem+json in 6 ms; list 500 generic, no host/credentials in body or log | yes (BOOT-06, ERR-05) |
| Log format | `[Nest] <pid> - <time> ERROR [ProblemDetails] {"event":"request_failed",...}` with ANSI colour codes, even with stdout piped and NODE_ENV=production | partly: content is safe, line is not machine-parseable JSON |

## 6. Gaps, ordered by severity

1. **High: the evaluator workflow fails on a fresh clone (OPS-05).** Scenario: `git clone`, `pnpm install --frozen-lockfile` (README.md:33-35), `pnpm check` (README.md:218). Result: typecheck exit 2 with 139 errors because `apps/api/src/generated/prisma` does not exist yet; `turbo.json:11-14` gives `typecheck` no dependency on Prisma generation, and only `build` (apps/api/package.json:10) generates. Second form: when Turbo has a cache hit for `build` (another worktree, CI with a restored `.turbo`, or after deleting the ignored client), only `dist/**` is restored (turbo.json:7), the client stays missing, and `test:unit` (20 suites) and `test:contract` (9 suites) fail to run. `pnpm typecheck` and `pnpm test:unit` run alone after install fail the same way. The graph is pinned by apps/api/test/workspace/turbo-graph.test.mjs:31, 33. The design required that "geração Prisma deve funcionar em checkout limpo e não depender de artefato ignorado da máquina". Fix direction: make `typecheck`/`test:*` depend on a generate task, or add `src/generated/**` to the build outputs, or generate in a `postinstall`.
2. **Medium: the time-zone proofs for ORDER-14 do not change the zone.** apps/api/src/orders/dto/order.presenter.spec.ts:91, apps/api/test/integration/orders-detail.integration-spec.ts:58 and orders-create.integration-spec.ts:53 assign `process.env.TZ` inside Jest, which has no effect (probe in section 4). All cases run in the host zone, so on a UTC CI runner the suite proves only UTC. Mutation M19 (store DATE from local midnight) passes the project's suites and fails 5 tests as soon as the process is started with `TZ=Pacific/Kiritimati`. Behaviour of the current code is correct (section 5). Fix direction: set `TZ` per Jest process (e.g. separate runs or `globalSetup`), not per test.
3. **Medium: production JWT verification options are untested (AUTH-04).** M07 and M08 survive the complete unit, contract and integration suites: removing `algorithms` or `issuer` from apps/api/src/auth/auth.module.ts:21-25 breaks nothing, because jwt-auth.guard.spec.ts:19-27 and auth.service.spec.ts:20-28 build their own JwtService copies and global-guard.http.spec.ts:56 covers only secret, audience and expiry. Scenario after such a regression: a token signed with the right secret but `iss: "evil"` is accepted on every order route. The current code rejects it (section 5).
4. **Medium: oversized bodies become 500 (ERR-08).** POST /api/v1/orders with a JSON body above Express's 100 KB default answers 500 INTERNAL_SERVER_ERROR and logs a `request_failed` error. Cause: apps/api/src/common/errors/problem-details.filter.ts:40-65 preserves status only for Nest `HttpException`s, and Nest converts only SyntaxError/URIError body-parser failures (`mapException` in @nestjs/platform-express express-adapter.js). The spec assumption "O filtro não deve transformar 403/405/413 ... em 400/500 genérico" is violated; the same applies to other http-errors raised by the body parser (for example 415 for an unsupported charset). No test sends an oversized body.
5. **Low: maximum-length acceptance is untested (VAL-01).** No test sends a 160-character customer name or street, a 20-character number, a 100-character neighborhood or city, or a 240-character item description and expects success. M26/M27 were caught only by the byte comparison with docs/openapi.json (openapi.contract-spec.ts:102); regenerating the document would hide such a change.
6. **Low: published OpenAPI differs from runtime rules (DOC-03).** docs/openapi.json: `UpdateOrderRequest` has no `minProperties: 1`; `DeliveryAddress.state` has `pattern ^[A-Z]{2}$` and `LoginRequest.email` a strict email pattern, so a client validating against the document rejects `"state": "sp"` or `" Demo@Example.TEST "`, which the API accepts and normalizes (orders-create.integration-spec.ts:53, auth.integration-spec.ts:36); page/pageSize defaults and 1..100 only appear in prose; the real-calendar date rule is not stated.
7. **Low: blank order-number filter (WEB-04).** Typing only spaces in "Número do pedido" and applying sends `orderNumber=%20%20%20` (orders-filters.tsx:43 passes the draft untrimmed; http-client.ts:71 omits only `''`); the API answers 400 and the list shows an error instead of treating the field as empty.
8. **Low (observability): failure logs are coloured text around JSON (ERR-06 note).** problem-details.filter.ts:80-88 logs through Nest's `ConsoleLogger` (application.ts:26), producing ANSI escape codes and a text prefix in production output; the entry has no error class or cause, so a 500 cannot be diagnosed from logs.
9. **Info.** BOOT-06 is tested with a never-reachable URL (health.integration-spec.ts:42), not by stopping a running database as spec I22 describes; the verifier confirmed the real case. With Docker unavailable the integration run also prints a secondary `TypeError: Cannot read properties of undefined (reading 'reset')` from setup.ts:16 after the correct diagnostic. QA-05 thresholds are global per app; `apps/api/src/orders` alone is 78.08 % lines in the unit coverage because orders.controller.ts is covered only by integration tests.

No secrets, stack traces, SQL, driver messages or credentials were found in any response body or log produced during the probes; no unbounded queue or input was found beyond item 4 (the body limit exists; only its status is wrong).

## 7. Conclusion

The delivery implements the contract: 87 of 94 judged criteria pass with code and discriminating tests, none fails outright, and the running API matched the tests in every probe except the 413 case. Seven criteria are PARTIAL, and two of the gaps (the fresh-clone gate and the ineffective time-zone tests) mean that the author's "pnpm check passes" and "tested under several time zones" claims hold only on a machine that already has the Prisma client generated and a non-UTC local zone. These rows should not move to "Verified" until gaps 1 to 4 are fixed and re-verified; gaps 5 to 8 are minor.

QA-07: evidence for. This validation.md was produced after the last implementation commit (dc8390c) by an independent verifier, with a verdict and file:line evidence for each of the 95 criteria, a 36-mutation discrimination sensor run in isolated scratch worktrees, and the real tree's `git status --porcelain` and HEAD identical before and after (the only side effect, four rewritten Turbo cache manifests in the ignored `.turbo/cache`, is disclosed above). It does not certify the delivery: 7 criteria are PARTIAL.
