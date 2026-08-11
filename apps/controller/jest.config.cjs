/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  testMatch: ['<rootDir>/src/**/*.render.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
