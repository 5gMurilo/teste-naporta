import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadBaseUrl(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
  else vi.stubEnv('VITE_API_BASE_URL', value);
  return (await import('./env')).apiBaseUrl;
}

describe('apiBaseUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to the same origin when VITE_API_BASE_URL is not set', async () => {
    expect(await loadBaseUrl(undefined)).toBe('');
  });

  it('removes trailing slashes from an absolute base URL', async () => {
    expect(await loadBaseUrl('https://api.example.test///')).toBe('https://api.example.test');
    expect(await loadBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });
});
