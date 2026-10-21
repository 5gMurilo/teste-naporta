import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { jest } from '@jest/globals';

jest.setTimeout(180_000);

const apiDirectory = resolve(import.meta.dirname, '../..');
const exporter = (...args: string[]) =>
  spawnSync('node', ['dist/docs/export-openapi.js', ...args], {
    cwd: apiDirectory,
    encoding: 'utf8',
  });

describe('docs:openapi --check', () => {
  it('fails docs:openapi:check for a diverging file and passes for the generated one', () => {
    execFileSync('pnpm', ['build'], { cwd: apiDirectory, stdio: 'inherit' });
    const directory = mkdtempSync(join(tmpdir(), 'naporta-openapi-'));
    try {
      const file = join(directory, 'openapi.json');
      writeFileSync(file, '{"openapi":"3.0.0"}\n');

      const diverging = exporter('--check', `--file=${file}`);
      const written = exporter(`--file=${file}`);
      const generated = readFileSync(file, 'utf8');
      const matching = exporter('--check', `--file=${file}`);
      writeFileSync(file, generated.replace('"openapi"', '"openapi "'));
      const edited = exporter('--check', `--file=${file}`);

      expect(diverging.status).toBe(1);
      expect(diverging.stderr).toContain('docs/openapi.json is out of date');
      expect(written.status).toBe(0);
      expect(generated).toBe(
        readFileSync(resolve(apiDirectory, '../../docs/openapi.json'), 'utf8'),
      );
      expect(matching.status).toBe(0);
      expect(edited.status).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
