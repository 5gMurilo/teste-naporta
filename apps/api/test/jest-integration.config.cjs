module.exports = {
  rootDir: '..',
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};
