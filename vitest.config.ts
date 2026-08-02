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
      // The ESLint rules this repo writes for itself. Their own project because
      // they live beside `eslint.config.js` rather than in a workspace package,
      // and because they drive ESLint over real source paths — no app, and no
      // react-native stub to get in the way of that.
      //
      // Every test here boots a real ESLint against the repo's real config and
      // several of them lint real files, so seconds are the unit of work rather
      // than milliseconds. Vitest's 5s default is set for pure functions and is
      // the wrong number for this project: it was survivable while one file
      // linted two screens, and the third rule's test — which lints every TV
      // source there is — put the whole project's files in contention and made
      // an existing test flake on a loaded machine. One timeout for the project
      // rather than a number sprinkled per test, because the reason is the
      // project's and not any one test's.
      {
        test: {
          name: 'lint-rules',
          include: ['eslint-rules/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
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
