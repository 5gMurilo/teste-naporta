import { resolve } from 'node:path';

/**
 * The repository-root `.env`. `main.ts` lives in `apps/api/src` (and, compiled, in `apps/api/dist`),
 * three levels below the root, so the file is found the same way in development and in production.
 */
export function repositoryEnvPath(fromDirectory: string): string {
  return resolve(fromDirectory, '../../../.env');
}
