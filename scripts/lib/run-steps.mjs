import { spawn } from 'node:child_process';

/**
 * Every gate of the delivery, cheapest first. Test tasks are `cache: false` in turbo.json, so a
 * cached result can never stand in for a run; container, browser, and integration steps start real
 * services. A step's failure is the failure of the whole command.
 */
export const STEPS = [
  { name: 'lint', command: ['pnpm', 'lint'] },
  { name: 'format:check', command: ['pnpm', 'format:check'] },
  { name: 'typecheck', command: ['pnpm', 'typecheck'] },
  { name: 'test:scripts', command: ['pnpm', 'test:scripts'] },
  { name: 'build', command: ['pnpm', 'build'] },
  { name: 'test:unit', command: ['pnpm', 'test:unit'] },
  { name: 'test:contract', command: ['pnpm', 'test:contract'] },
  { name: 'docs:openapi:check', command: ['pnpm', 'docs:openapi:check'] },
  { name: 'test:coverage', command: ['pnpm', 'test:coverage'] },
  { name: 'test:e2e', command: ['pnpm', 'test:e2e'] },
  { name: 'test:integration', command: ['pnpm', 'test:integration'] },
  { name: 'test:e2e:web', command: ['pnpm', 'test:e2e:web'] },
  { name: 'test:containers', command: ['pnpm', 'test:containers'] },
];

export function runCommand(command) {
  return new Promise((resolve) => {
    const [file, ...args] = command;
    const child = spawn(file, args, { stdio: 'inherit' });
    child.once('error', () => resolve(127));
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
  });
}

/**
 * Runs the steps in order. By default it stops at the first failure; with keepGoing it runs the
 * rest and still fails at the end. The result lists the exit code of every step that ran.
 */
export async function runSteps(steps, { run = runCommand, log = console.log, keepGoing = false } = {}) {
  const results = [];
  for (const step of steps) {
    log(`\n==> ${step.name}: ${step.command.join(' ')}`);
    const started = Date.now();
    const exitCode = await run(step.command);
    results.push({ name: step.name, exitCode, seconds: Math.round((Date.now() - started) / 1000) });
    if (exitCode !== 0 && !keepGoing) break;
  }
  const skipped = steps.slice(results.length).map((step) => step.name);
  const ok = skipped.length === 0 && results.every((result) => result.exitCode === 0);

  log('\nSummary');
  for (const { name, exitCode, seconds } of results) {
    log(`  ${exitCode === 0 ? 'PASS' : 'FAIL'}  ${name}  (exit ${exitCode}, ${seconds}s)`);
  }
  for (const name of skipped) log(`  SKIP  ${name}  (not run after a failure)`);
  log(ok ? '\nAll checks passed.' : '\nChecks failed.');
  return { ok, results, skipped };
}
