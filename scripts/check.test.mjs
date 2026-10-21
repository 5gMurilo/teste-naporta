import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runSteps, STEPS } from './lib/run-steps.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const rootPackage = JSON.parse(read('package.json'));
const turbo = JSON.parse(read('turbo.json'));
const silent = () => undefined;

describe('pnpm check aggregator (OPS-05, QA-05, QA-06, MONO-03, DOC-05)', () => {
  it('is wired as the root check command and covers every required gate', () => {
    assert.equal(rootPackage.scripts.check, 'node scripts/check.mjs');
    const names = STEPS.map((step) => step.name);
    for (const required of [
      'lint',
      'format:check',
      'typecheck',
      'build',
      'test:unit',
      'test:contract',
      'test:coverage',
      'test:integration',
      'test:e2e',
      'test:e2e:web',
      'test:containers',
      'docs:openapi:check',
    ]) {
      assert.ok(names.includes(required), `${required} must be part of the check`);
    }
    for (const step of STEPS) {
      assert.equal(typeof rootPackage.scripts[step.command[1]], 'string', `${step.command.join(' ')} must exist`);
    }
  });

  it('stops at the first failing step, reports its exit code, and fails', async () => {
    const ran = [];
    const steps = [
      { name: 'one', command: ['ok'] },
      { name: 'two', command: ['boom'] },
      { name: 'three', command: ['never'] },
    ];

    const outcome = await runSteps(steps, {
      log: silent,
      run: async ([command]) => {
        ran.push(command);
        return command === 'boom' ? 3 : 0;
      },
    });

    assert.equal(outcome.ok, false);
    assert.deepEqual(ran, ['ok', 'boom']);
    assert.deepEqual(outcome.results.map((r) => [r.name, r.exitCode]), [['one', 0], ['two', 3]]);
    assert.deepEqual(outcome.skipped, ['three']);
  });

  it('with --keep-going runs every step and still fails when any one failed', async () => {
    const steps = [
      { name: 'one', command: ['bad'] },
      { name: 'two', command: ['ok'] },
    ];

    const outcome = await runSteps(steps, {
      log: silent,
      keepGoing: true,
      run: async ([command]) => (command === 'bad' ? 1 : 0),
    });

    assert.equal(outcome.ok, false);
    assert.equal(outcome.results.length, 2);
  });

  it('succeeds only when every step exits with zero', async () => {
    const outcome = await runSteps(STEPS.slice(0, 3), { log: silent, run: async () => 0 });

    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.skipped, []);
  });

  it('treats a command that cannot even start as a failure, never as a pass', async () => {
    const { runCommand } = await import('./lib/run-steps.mjs');

    assert.notEqual(await runCommand(['definitely-not-a-command-naporta']), 0);
  });

  it('never lets Turbo cache a test, coverage, browser, or state task', () => {
    for (const task of [
      'test:unit',
      'test:coverage',
      'test:contract',
      'test:e2e',
      'test:e2e:web',
      'test:integration',
      'docs:openapi:check',
      'lint',
    ]) {
      assert.equal(turbo.tasks[task]?.cache, false, `${task} must not be cached`);
    }
  });

  it('keeps the 80% lines and 70% branches coverage gates configured for both applications', () => {
    assert.match(read('apps/api/jest.config.cjs'), /lines: 80, branches: 70/);
    assert.match(read('apps/web/vite.config.ts'), /thresholds: \{ lines: 80, branches: 70 \}/);
    assert.match(read('apps/api/package.json'), /"docs:openapi:check"/);
  });

  it('exposes every script named in the delivery specification at the repository root', () => {
    for (const script of [
      'dev',
      'build',
      'start:prod',
      'db:generate',
      'db:migrate:dev',
      'db:migrate:deploy',
      'db:seed',
      'docs:openapi',
      'lint',
      'format',
      'format:check',
      'typecheck',
      'test:unit',
      'test:integration',
      'test:e2e:web',
      'test:containers',
      'test:coverage',
      'check',
    ]) {
      assert.equal(typeof rootPackage.scripts[script], 'string', `root script ${script} is missing`);
    }
    for (const task of ['db:generate', 'db:migrate:deploy', 'start:prod']) {
      assert.equal(turbo.tasks[task]?.cache, false, `${task} must not be cached`);
    }
  });
});
