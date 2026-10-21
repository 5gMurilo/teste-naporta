import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { repositoryEnvPath } from './env-file.js';

describe('repositoryEnvPath', () => {
  it('points next to the root package.json of the monorepo, from source and from the compiled output', () => {
    for (const directory of [import.meta.dirname, join(import.meta.dirname, '../dist')]) {
      const envPath = repositoryEnvPath(directory);
      const rootManifest = JSON.parse(readFileSync(join(dirname(envPath), 'package.json'), 'utf8'));

      expect(envPath.endsWith('/.env')).toBe(true);
      expect(rootManifest.name).toBe('teste-naporta');
    }
  });
});
