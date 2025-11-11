const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  roots: [
    '<rootDir>/src/app/api/review/session/start/__tests__',
    '<rootDir>/src/app/api/review/queue/__tests__',
    '<rootDir>/src/app/api/review/pin/__tests__',
  ],
};
