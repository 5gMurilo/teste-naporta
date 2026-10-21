import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../../', import.meta.url);
const rootPackage = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const apiPackage = JSON.parse(await readFile(new URL('apps/api/package.json', root), 'utf8'));
const webPackage = JSON.parse(await readFile(new URL('apps/web/package.json', root), 'utf8'));
const turbo = JSON.parse(await readFile(new URL('turbo.json', root), 'utf8'));
const jestConfig = await readFile(new URL('apps/api/jest.config.cjs', root), 'utf8');

test('root build, typecheck, unit, and dev commands delegate to Turbo', () => {
  assert.equal(rootPackage.scripts.build, 'turbo run build');
  assert.equal(rootPackage.scripts.typecheck, 'turbo run typecheck');
  assert.equal(rootPackage.scripts['test:unit'], 'turbo run test:unit');
  assert.equal(rootPackage.scripts.dev, 'turbo run dev');
  assert.equal(rootPackage.scripts.format, 'turbo run format');
  assert.equal(rootPackage.scripts['format:check'], 'turbo run format:check');
  assert.equal(rootPackage.scripts['test:coverage'], 'turbo run test:coverage');
});

test('API build and typecheck expose workspace tasks with build outputs', () => {
  assert.equal(typeof apiPackage.scripts.build, 'string');
  assert.equal(typeof apiPackage.scripts.typecheck, 'string');
  assert.equal(typeof apiPackage.scripts.format, 'string');
  assert.equal(typeof apiPackage.scripts['format:check'], 'string');
  assert.equal(typeof apiPackage.scripts['test:coverage'], 'string');
  assert.deepEqual(turbo.tasks.build.dependsOn, ['^build']);
  assert.deepEqual(turbo.tasks.build.outputs, ['dist/**']);
  assert.deepEqual(turbo.tasks.build.passThroughEnv, ['DATABASE_URL']);
  assert.deepEqual(turbo.tasks.typecheck.dependsOn, ['^typecheck']);
});

test('Turbo resolves the root build command to both application packages', () => {
  const result = spawnSync('pnpm', ['exec', 'turbo', 'run', 'build', '--dry=json'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
  assert.deepEqual([...plan.packages].sort(), ['@naporta/api', '@naporta/web']);
  assert.equal(
    plan.tasks.find((task) => task.taskId === '@naporta/api#build').command,
    apiPackage.scripts.build,
  );
  assert.equal(
    plan.tasks.find((task) => task.taskId === '@naporta/web#build').command,
    webPackage.scripts.build,
  );
});

test('root quality commands reach the web app through Turbo', () => {
  for (const script of [
    'lint',
    'lint:fix',
    'format',
    'format:check',
    'typecheck',
    'test:unit',
    'test:coverage',
  ]) {
    assert.equal(
      rootPackage.scripts[script],
      `turbo run ${script}`,
      `${script} must run through Turbo`,
    );
    assert.equal(typeof webPackage.scripts[script], 'string', `web must define ${script}`);
  }
  assert.equal(webPackage.name, '@naporta/web');
  assert.equal(turbo.tasks.lint.cache, false);
});

test('the web workspace uses the single lockfile and declares only public configuration', async () => {
  const lockfile = await readFile(new URL('pnpm-lock.yaml', root), 'utf8');
  assert.match(lockfile, /^ {2}apps\/web:$/m);
  assert.match(lockfile, /^ {2}apps\/api:$/m);
  const workspace = await readFile(new URL('pnpm-workspace.yaml', root), 'utf8');
  assert.match(workspace, /apps\/\*/);
});

test('development is persistent and cannot be cached', () => {
  assert.equal(turbo.tasks.dev.persistent, true);
  assert.equal(turbo.tasks.dev.cache, false);
});

test('unit, coverage, and workspace verification tasks cannot be cached', () => {
  for (const task of ['test:unit', 'test:coverage', 'test:workspace']) {
    assert.equal(turbo.tasks[task].cache, false, `${task} must not be cached`);
  }
});

test('HTTP, integration, and Prisma state tasks cannot be cached', () => {
  for (const task of ['test:e2e', 'test:integration', 'prisma:generate', 'prisma:validate']) {
    assert.equal(turbo.tasks[task].cache, false, `${task} must not be cached`);
  }
  assert.deepEqual(turbo.tasks['prisma:validate'].passThroughEnv, ['DATABASE_URL']);
  assert.equal(typeof rootPackage.scripts['test:integration'], 'string');
  assert.equal(typeof apiPackage.scripts['test:integration'], 'string');
});

test('coverage includes unimported source and enforces the reviewed thresholds', () => {
  assert.match(jestConfig, /['"]src\/\*\*\/\*\.ts['"]/);
  assert.match(jestConfig, /lines: 80, branches: 70/);
  assert.match(jestConfig, /!src\/generated/);
  assert.match(jestConfig, /!src\/main\.ts/);
});
