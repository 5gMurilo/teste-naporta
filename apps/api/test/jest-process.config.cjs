// Suites that build the API and spawn it as a child process. They rewrite dist/, so they run one
// at a time and never beside the integration suites that read it.
const integration = require('./jest-integration.config.cjs');

module.exports = {
  ...integration,
  testMatch: ['<rootDir>/test/process/**/*.process-spec.ts'],
  maxWorkers: 1,
};
