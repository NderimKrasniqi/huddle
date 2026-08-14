import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// One runner for the whole workspace. Convex functions need the edge runtime
// convex-test emulates the backend in; everything else (game modules, packs) is
// plain TypeScript on Node.
//
// Every project resolves `react-native` to an import-only stub. Game Modules
// still expose native screens, but the Node suites never mount them.
const reactNativeStub = fileURLToPath(new URL('./test/react-native-stub.ts', import.meta.url));
const stubReactNative = {
  alias: { 'react-native': reactNativeStub },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: stubReactNative,
        test: {
          name: 'convex',
          root: './convex',
          environment: 'edge-runtime',
          exclude: ['**/node_modules/**'],
          server: { deps: { inline: ['convex-test'] } },
        },
      },
      {
        resolve: stubReactNative,
        test: {
          name: 'packages',
          include: ['packages/**/src/**/*.test.ts', 'games/*/src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/future/**', '**/*.render.test.tsx'],
          environment: 'node',
        },
      },
      // The apps are mostly React Native, which docs/tech-stack.md deliberately does
      // not test — but the plumbing under `src/` that holds an app together is
      // plain TypeScript, and that much is worth a unit test.
      {
        resolve: stubReactNative,
        test: {
          name: 'apps',
          include: ['apps/*/src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/*.render.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'visual-fixtures',
          include: ['test/visual-fixtures/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
