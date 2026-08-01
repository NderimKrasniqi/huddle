import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// One runner for the whole workspace. Convex functions need the edge runtime
// convex-test emulates the backend in; everything else (game modules, packs) is
// plain TypeScript on Node.
//
// Every project resolves `react-native` to a stub. A Game Module's `screens`
// reach React Native, and React Native's own source is Flow-typed and
// unparseable by Node — so the Registry's tests, the carousel's, and the hub's
// would all fail on the import alone, without ever rendering anything. See
// `test/react-native-stub.ts` for what that does and does not license.
const reactNativeStub = fileURLToPath(new URL('./test/react-native-stub.ts', import.meta.url));
const stubReactNative = { alias: { 'react-native': reactNativeStub } };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: stubReactNative,
        test: {
          name: 'convex',
          root: './convex',
          environment: 'edge-runtime',
          server: { deps: { inline: ['convex-test'] } },
        },
      },
      // The one ESLint rule this repo writes for itself. Its own project because
      // it lives beside `eslint.config.js` rather than in a workspace package,
      // and because it drives ESLint over real source paths — no app, and no
      // react-native stub to get in the way of that.
      {
        test: {
          name: 'lint-rules',
          include: ['eslint-rules/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: stubReactNative,
        test: {
          name: 'packages',
          include: ['packages/**/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      // The apps are mostly React Native, which tech-stack.md deliberately does
      // not test — but the plumbing under `src/` that holds an app together is
      // plain TypeScript, and that much is worth a unit test.
      {
        resolve: stubReactNative,
        test: {
          name: 'apps',
          include: ['apps/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
