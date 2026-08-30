/* global __dirname */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  testMatch: ['<rootDir>/src/**/*.render.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
