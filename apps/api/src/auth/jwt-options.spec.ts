import { jwtModuleOptions } from './jwt-options.js';

const config = {
  JWT_SECRET: 's'.repeat(32),
  JWT_EXPIRES_IN: 900,
  JWT_ISSUER: 'naporta-test',
  JWT_AUDIENCE: 'naporta-web-test',
};

describe('jwtModuleOptions (AUTH-02, AUTH-04)', () => {
  it('signs with HS256 and the configured lifetime, issuer, and audience', () => {
    expect(jwtModuleOptions(config).signOptions).toEqual({
      algorithm: 'HS256',
      expiresIn: 900,
      issuer: 'naporta-test',
      audience: 'naporta-web-test',
    });
  });

  it('pins the algorithm, issuer, and audience when verifying', () => {
    expect(jwtModuleOptions(config).verifyOptions).toEqual({
      algorithms: ['HS256'],
      issuer: 'naporta-test',
      audience: 'naporta-web-test',
    });
  });
});
