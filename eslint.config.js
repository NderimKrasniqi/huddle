// One flat config for the whole workspace. The apps are Expo/React Native and
// everything else (packages/*, convex/) is plain TypeScript that the same Expo
// config covers — so lint runs once from the root rather than per package.
//
// eslint-config-expo levels most rules at "warn"; the `lint` script runs with
// --max-warnings=0 so the CI gate is real.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

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
]);
