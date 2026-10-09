/* global __dirname */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  // Shared packages resolve their own Reanimated install under pnpm; point
  // every import at the one published mock so no native initialiser runs.
  moduleNameMapper: {
    '^react-native-reanimated$': '<rootDir>/jest.reanimated.cjs',
    '^react-native-worklets$': require.resolve('react-native-worklets/src/mock.ts'),
    // The phone app does not ship Skia; Metro aliases it to this stub too.
    '^@shopify/react-native-skia$': '<rootDir>/metro-stubs/react-native-skia.tsx',
  },
  testMatch: ['<rootDir>/src/**/*.render.test.tsx'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
