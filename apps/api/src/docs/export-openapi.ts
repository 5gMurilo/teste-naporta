import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApplication } from '../application.js';
import { loadApiConfig } from '../config/env.js';
import { buildOpenApiDocument } from './openapi.js';

// Synthetic, non-secret values: documentation export never touches PostgreSQL or Redis.
const DOCS_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://docs:docs@localhost:5432/docs',
  JWT_SECRET: 'documentation-only-placeholder-secret',
  JWT_ISSUER: 'naporta',
  JWT_AUDIENCE: 'naporta-web',
  JWT_EXPIRES_IN: '3600',
  REDIS_URL: 'redis://localhost:6379',
} as const;

export const OPENAPI_PATH = resolve(import.meta.dirname, '../../../../docs/openapi.json');

export async function exportOpenApi(): Promise<string> {
  const app = await createApplication(loadApiConfig(DOCS_ENV), 'docs');
  try {
    return `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`;
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  try {
    const generated = await exportOpenApi();
    if (check) {
      const current = await readFile(OPENAPI_PATH, 'utf8').catch(() => undefined);
      if (current !== generated) {
        console.error('docs/openapi.json is out of date. Run pnpm docs:openapi.');
        process.exitCode = 1;
      }
      return;
    }
    await mkdir(dirname(OPENAPI_PATH), { recursive: true });
    await writeFile(OPENAPI_PATH, generated);
    console.info('docs/openapi.json written.');
  } catch {
    console.error('OpenAPI export failed.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
