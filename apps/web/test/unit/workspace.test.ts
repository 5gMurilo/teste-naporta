import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';

const root = join(import.meta.dirname, '../..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe('web workspace configuration', () => {
  it('proxies /api to the API during development and builds a static bundle', () => {
    expect(config.server?.proxy).toMatchObject({
      '/api': { target: expect.stringMatching(/^https?:\/\//), changeOrigin: true },
    });
    expect(config.build?.outDir).toBe('dist');
    expect(config.build?.sourcemap).toBe(false);
  });

  it('enforces the 80% lines and 70% branches coverage thresholds on unimported files too', () => {
    const coverage = config.test?.coverage;
    expect(coverage).toMatchObject({ thresholds: { lines: 80, branches: 70 } });
    expect(coverage && 'include' in coverage ? coverage.include : []).toContain(
      'src/**/*.{ts,tsx}',
    );
  });

  it('reads only the allowed public variable from import.meta.env', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(root, 'src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
        used.add(match[1] as string);
      }
    }

    expect([...used]).toEqual(['VITE_API_BASE_URL']);
  });

  it('declares no secret-like variable among the public VITE_ names', () => {
    const declaration = readFileSync(join(root, 'src/vite-env.d.ts'), 'utf8');
    const names = [...declaration.matchAll(/readonly (VITE_[A-Z0-9_]+)\??:/g)].map((m) => m[1]);

    expect(names).toEqual(['VITE_API_BASE_URL']);
    expect(names.join(' ')).not.toMatch(/SECRET|PASSWORD|TOKEN|DATABASE|REDIS|JWT/);
  });

  it('keeps the development proxy target out of the VITE_ namespace', () => {
    expect(readFileSync(join(root, 'vite.config.ts'), 'utf8')).not.toMatch(/VITE_[A-Z_]*PROXY/);
  });
});
