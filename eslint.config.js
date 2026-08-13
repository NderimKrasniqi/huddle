// One flat config for the whole workspace. The apps are Expo/React Native and
// everything else (packages/*, convex/) is plain TypeScript that the same Expo
// config covers — so lint runs once from the root rather than per package.
//
// eslint-config-expo levels most rules at "warn"; the `lint` script runs with
// --max-warnings=0 so the CI gate is real.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const bodyTextFloor = require('./eslint-rules/soft-minimal-body-text-floor');
const tokensOnly = require('./eslint-rules/soft-minimal-tokens-only');
const tvRemoteSurface = require('./eslint-rules/huddle-tv-remote-surface');

// One plugin object for both of Soft Minimal's rules, shared by reference: two
// config blocks that each defined a `soft-minimal` plugin of their own would be
// two different objects under one name, which flat config refuses.
const softMinimal = {
  rules: { 'tokens-only': tokensOnly, 'body-text-floor': bodyTextFloor },
};

// A second plugin rather than a third Soft Minimal rule. Soft Minimal is the design
// system — what a screen is drawn with — and `huddle` is the product: Eyes up is
// this repo's name for a line in docs/project-scope.md, not anything in the
// handoff, and a television with a focusable button on it would be in perfect
// Soft Minimal style.
const huddle = { rules: { 'tv-remote-surface': tvRemoteSurface } };

// Soft Minimal's floors, as `packages/ui` holds them (`minBodyFontSize`) — the
// smallest sizes on the handoff's own scale, phone caption 12 and TV caption
// 16. Written
// out here because nothing in this repo compiles a config, so a CommonJS file
// cannot import the TypeScript token — `eslint-rules/soft-minimal-body-text-floor.test.ts`
// reads this config and the token and fails if the two ever disagree.
const MIN_BODY_FONT_SIZE = { tv: 16, phone: 12 };

module.exports = defineConfig([
  globalIgnores([
    '**/dist/**',
    // Generated, not authored: Expo writes expo-env.d.ts and .expo/ on
    // `expo start`, and Convex writes `_generated` from the schema and function
    // modules (it is committed so CI needs no Convex deployment).
    '**/.expo/**',
    '**/expo-env.d.ts',
    'convex/convex/_generated/**',
    // Linked git worktrees the agent harness checks out under here for
    // background tasks: a whole second copy of the repo (with its own generated
    // files), gitignored and transient. `eslint .` walks the filesystem, not
    // git, so without this it lints another branch's checkout and fails on it.
    '.claude/**',
  ]),

  expoConfig,

  // NativeWind, Expo Image, and Reanimated are the only active client styling,
  // image, and animation seams. Keep the removed React Native APIs from
  // drifting back into either app, shared native UI, or a game-owned screen.
  {
    files: [
      'apps/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
      'games/*/src/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Animated', 'Image', 'ImageBackground', 'StyleSheet'],
              message:
                'Use Reanimated/Worklets, Expo Image, and NativeWind semantic classes. StyleSheet is not part of the active UI stack.',
            },
          ],
        },
      ],
    },
  },

  // Soft Minimal's own rule: a colour, radius, border width, shadow depth or font
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
    plugins: { 'soft-minimal': softMinimal },
    rules: { 'soft-minimal/tokens-only': 'error' },
  },

  // Soft Minimal's other rule, and the half of it that is config: body text is
  // floored at the smallest size the surface it is read from allows, and this
  // is where the repo says which surface a file stands on. Two blocks and not
  // one, because 12 and 16 are two floors rather than a lax one and a strict
  // one — a repo-wide 16 would be the television's answer written over the
  // phone's, and a repo-wide 12 would un-ban on the TV everything the TV block
  // exists to catch. The rule is handed the whole `MIN_BODY_FONT_SIZE` table
  // either way, so each surface can read the *other's* floor as a number when
  // it is written where it does not belong.
  //
  // Both blocks name a game module's screens by file name, which is the
  // convention every module follows (`tv-screen.tsx` beside
  // `phone-screen.tsx`) and the only handle a config has: a module that
  // drew a screen out of a file named something else would sit outside the
  // gate. What neither block names is `packages/ui`, which both surfaces import
  // — a shared primitive stands on no one surface, so it cannot be given a
  // floor here. None of them sets a `fontSize` today.
  {
    files: ['apps/tv/**/*.ts', 'apps/tv/**/*.tsx', 'games/*/src/tv-*.tsx'],
    plugins: { 'soft-minimal': softMinimal },
    rules: {
      'soft-minimal/body-text-floor': ['error', { surface: 'tv', minBodyFontSize: MIN_BODY_FONT_SIZE }],
    },
  },
  // Eyes up, as a gate: the television is the stage and the phones are the
  // phones, so nothing a TV screen draws may be reachable with the remote.
  // Switched on for exactly the paths the TV floor above covers — the same two
  // globs, because "the TV surface" is one answer and having it written twice
  // differently is how one of them ends up wrong. The Phone is pointedly
  // not among them: its screens are made of controls.
  //
  // The rule takes no options. It used to be handed the one file allowed to
  // hold the remote's key listener, which was the About Panel; the approved
  // design does not draw an About Panel, so that file is gone and with it the
  // only exemption the TV surface had.
  {
    files: ['apps/tv/**/*.ts', 'apps/tv/**/*.tsx', 'games/*/src/tv-*.tsx'],
    plugins: { huddle },
    rules: {
      'huddle/tv-remote-surface': 'error',
    },
  },

  {
    files: [
      'apps/phone/**/*.ts',
      'apps/phone/**/*.tsx',
      'games/*/src/phone-*.tsx',
    ],
    plugins: { 'soft-minimal': softMinimal },
    rules: {
      'soft-minimal/body-text-floor': [
        'error',
        { surface: 'phone', minBodyFontSize: MIN_BODY_FONT_SIZE },
      ],
    },
  },

  // F-011: the Trivia pack stays server-side. `content/curated-pack` carries
  // every question's text and correct answer, and `questionsFor` is
  // deterministic, so a client that imports it can reproduce the exact deal.
  // Only trivia's server-only `questions.ts` may reach it. Client files use the
  // hand-authored `content/categories` projection instead. This direct-import
  // gate complements the transitive package/export seam checks in the
  // architecture validator.
  {
    files: [
      'apps/**/*.ts',
      'apps/**/*.tsx',
      'games/*/src/**/*.ts',
      'games/*/src/**/*.tsx',
    ],
    // `questions.ts` is the one client-path file that legitimately holds the
    // pack — it *is* the deal, and only the server pulls it. Tests are exempt
    // too: they import the pack to assert against it and are never bundled into
    // an app, so the thing this gate protects (the client bundle) is not
    // something a `.test.ts` can be in.
    ignores: [
      'games/*/src/questions.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Animated', 'Image', 'ImageBackground', 'StyleSheet'],
              message:
                'Use Reanimated/Worklets, Expo Image, and NativeWind semantic classes. StyleSheet is not part of the active UI stack.',
            },
            {
              name: './content/curated-pack',
              message:
                'The Trivia pack must not ship in a client bundle (F-011): content/curated-pack carries every answer. Import category names from ./content/categories; only trivia questions.ts may reach the pack.',
            },
            {
              name: '@huddle/game-trivia/src/content/curated-pack',
              message:
                'The Trivia pack is server-only (F-011). Use the client-safe category projection from @huddle/game-trivia.',
            },
          ],
        },
      ],
    },
  },
]);
