// One flat config for the whole workspace. The apps are Expo/React Native and
// everything else (packages/*, convex/) is plain TypeScript that the same Expo
// config covers — so lint runs once from the root rather than per package.
//
// eslint-config-expo levels most rules at "warn"; the `lint` script runs with
// --max-warnings=0 so the CI gate is real.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const tokensOnly = require('./eslint-rules/boardwalk-tokens-only');

module.exports = defineConfig([
  globalIgnores([
    '**/dist/**',
    // Generated, not authored: Expo writes expo-env.d.ts and .expo/ on
    // `expo start`, and Convex writes `_generated` from the schema and function
    // modules (it is committed so CI needs no Convex deployment).
    '**/.expo/**',
    '**/expo-env.d.ts',
    'convex/convex/_generated/**',
  ]),

  expoConfig,

  // Boardwalk's own rule: a colour, radius, border width, shadow depth or font
  // family is read from a `packages/ui` token and never written where it is
  // used. Repo-wide rather than trivia-only — the trivia screens are what the
  // plan's acceptance criterion names, but the hub screens turned out to hold
  // no violation either, so scoping it narrower would have been choosing a
  // weaker gate for nothing. `packages/ui/src` is exempt because it *is* the
  // theme: the same exemption `color-literals.test.ts` makes, for the same
  // reason.
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['packages/ui/src/**'],
    plugins: { boardwalk: { rules: { 'tokens-only': tokensOnly } } },
    rules: { 'boardwalk/tokens-only': 'error' },
  },
]);
