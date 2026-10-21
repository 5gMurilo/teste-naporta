import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const decisions = read('docs/decisions.md');
const normalized = decisions.toLowerCase();

describe('docs/decisions.md (DOC-06, CACHE-05, WEB-01, MONO-01)', () => {
  it('records creation and last update dates in a visible section', () => {
    assert.match(decisions, /^## Datas$/m);
    assert.match(decisions, /Criado em: \d{4}-\d{2}-\d{2}/);
    assert.match(decisions, /Última atualização: \d{4}-\d{2}-\d{2}/);
  });

  it('covers every decision the specification requires', () => {
    for (const topic of [
      'monólito',
      'postgresql',
      'jsonb',
      '1:n',
      'centavos',
      'zod',
      'dto',
      'utc',
      'concorrência',
      'esm',
      'cache-aside',
      'ttl',
      'chave versionada',
      'revisão',
      'pós-commit',
      'depois do commit',
      'fail-open',
      'não se alega ganho',
      'listas',
      'react',
      'vite',
      'sem ssr',
      'shadcn',
      'memória',
      'turborepo',
      'containers',
    ]) {
      assert.ok(normalized.includes(topic), `decisions.md must mention "${topic}"`);
    }
  });

  it('explains that a cache hit still queries the database and claims no measured gain', () => {
    assert.match(decisions, /hit ainda faz uma consulta pequena ao banco/);
    assert.match(decisions, /não se alega ganho de\s+desempenho/);
    assert.match(decisions, /nenhuma medição foi feita/);
  });

  it('keeps a table of deviations from the plan with a reason for each', () => {
    const section = decisions.split('## Desvios do plano')[1]?.split('## Limitações verificadas')[0] ?? '';
    const rows = section.split('\n').filter((line) => line.startsWith('|') && !line.includes('---'));
    assert.ok(rows.length >= 6, 'header plus at least five deviations');
    for (const row of rows.slice(1)) {
      const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean);
      assert.equal(cells.length, 2, `deviation needs a description and a reason: ${row}`);
      assert.ok(cells[1].length > 10, `reason is too short: ${row}`);
    }
  });

  it('only links to files that exist', () => {
    for (const file of ['docs/decisions.md', 'docs/INDEX.md', 'README.md']) {
      const text = read(file);
      for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/i.test(target)) continue;
        const resolved = resolve(root, dirname(file), target);
        assert.ok(existsSync(resolved), `${file} links to ${target}, which does not exist`);
      }
    }
  });

  it('agrees with the runtime on the values it states', () => {
    const cache = read('apps/api/src/cache/orders-detail.cache.ts');
    const env = read('apps/api/src/config/env.ts');
    const migration = read('apps/api/prisma/migrations/20261021120000_orders_and_users/migration.sql');
    const redis = read('apps/api/src/cache/cache.module.ts');

    assert.ok(cache.includes('naporta:v1:orders:${orderId}:detail'));
    assert.ok(decisions.includes('naporta:v1:orders:{id}:detail'));
    assert.match(env, /CACHE_TTL_SECONDS: z\.coerce\.number\(\)\.int\(\)\.positive\(\)\.default\(60\)/);
    assert.match(env, /CACHE_TIMEOUT_MS: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(5000\)\.default\(200\)/);
    assert.match(decisions, /TTL de 60 s/);
    assert.match(decisions, /\(200 ms\)/);
    assert.match(migration, /Order_orderNumber_key/);
    assert.match(migration, /Order_deletedAt_createdAt_id_idx/);
    assert.match(redis, /MAX_QUEUED_COMMANDS = 100/);
    assert.match(read('apps/api/src/orders/orders.repository.ts'), /ReadCommitted/);
    assert.match(read('apps/api/src/orders/orders.repository.ts'), /RepeatableRead/);
  });

  it('is indexed and has no emojis', () => {
    const index = read('docs/INDEX.md');
    assert.match(index, /\[decisions\.md\]\(decisions\.md\)/);
    assert.match(index, /\[openapi\.json\]\(openapi\.json\)/);
    assert.match(index, /Criado em: \d{4}-\d{2}-\d{2}/);
    for (const text of [decisions, index, read('README.md')]) {
      assert.doesNotMatch(text, /\p{Extended_Pictographic}/u);
    }
  });
});
