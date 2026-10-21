import { loadConfig } from './env.js';

describe('loadConfig', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = { ...original };
  });
  afterAll(() => {
    process.env = original;
  });

  it('defaults PORT to 3000', () => {
    delete process.env.PORT;
    process.env.DATABASE_URL = 'postgresql://localhost/db';
    expect(loadConfig().PORT).toBe(3000);
  });

  it.each([undefined, 'bad-url', 'https://localhost/db'])(
    'rejects invalid DATABASE_URL %s',
    (url) => {
      if (url === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = url;
      expect(() => loadConfig()).toThrow('Invalid environment');
    },
  );

  it.each(['0', '65536', '1.5', 'abc'])('rejects invalid PORT %s', (port) => {
    process.env.DATABASE_URL = 'postgres://localhost/db';
    process.env.PORT = port;
    expect(() => loadConfig()).toThrow('Invalid environment');
  });
});
