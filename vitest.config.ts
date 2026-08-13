import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// One runner for the whole workspace. Convex functions need the edge runtime
// convex-test emulates the backend in; everything else (game modules, packs) is
// plain TypeScript on Node.
//
// Every project resolves `react-native` and `react-native-svg` to stubs. A Game
// Module's `screens` reach both — React Native directly, and the SVG package
// through `@huddle/ui/native`'s icon set — and both ship source Node cannot
// parse, so the Registry's tests, the carousel's, and the hub's would all fail
// on the import alone, without ever rendering anything. See the two stub files
// for what that does and does not license.
//
// The aliases are exact module names, so `react-native-svg` needs its own entry
// rather than being caught by the first: a prefix match would also swallow
// `react-native-safe-area-context` and anything else named this way.
const reactNativeStub = fileURLToPath(new URL('./test/react-native-stub.ts', import.meta.url));
const reactNativeSvgStub = fileURLToPath(
  new URL('./test/react-native-svg-stub.ts', import.meta.url),
);
const stubReactNative = {
  alias: { 'react-native': reactNativeStub, 'react-native-svg': reactNativeSvgStub },
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
