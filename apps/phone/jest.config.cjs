/* global __dirname */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  moduleNameMapper: {
    '^expo-image$': '<rootDir>/../../tools/jest-expo-image-mock.cjs',
    '^react-native-reanimated$': '<rootDir>/../../tools/jest-reanimated-mock.cjs',
  },
  testMatch: ['<rootDir>/src/**/*.render.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
