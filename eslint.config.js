// One flat config for the whole workspace. The apps are Expo/React Native and
// everything else (packages/*, convex/) is plain TypeScript that the same Expo
// config covers — so lint runs once from the root rather than per package.
//
// eslint-config-expo levels most rules at "warn"; the `lint` script runs with
// --max-warnings=0 so the CI gate is real.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const bodyTextFloor = require('./eslint-rules/boardwalk-body-text-floor');
const tokensOnly = require('./eslint-rules/boardwalk-tokens-only');
const tvRemoteSurface = require('./eslint-rules/huddle-tv-remote-surface');

// One plugin object for both of Boardwalk's rules, shared by reference: two
// config blocks that each defined a `boardwalk` plugin of their own would be
// two different objects under one name, which flat config refuses.
const boardwalk = {
  rules: { 'tokens-only': tokensOnly, 'body-text-floor': bodyTextFloor },
};

// A second plugin rather than a third Boardwalk rule. Boardwalk is the design
// system — what a screen is drawn with — and `huddle` is the product: Eyes up is
// a line in docs/project-scope.md, not in the handoff, and a television with a
// focusable button on it would be in perfect Boardwalk style.
const huddle = { rules: { 'tv-remote-surface': tvRemoteSurface } };

// The one file allowed to hold the remote's key listener — see the rule.
// Repo-relative, like every other path here.
const THE_REMOTE_OWNER = 'apps/tv/src/tv-about.tsx';

// Boardwalk's floors, as `packages/ui` holds them (`minBodyFontSize`). Written
// out here because nothing in this repo compiles a config, so a CommonJS file
// cannot import the TypeScript token — `eslint-rules/boardwalk-body-text-floor.test.ts`
// reads this config and the token and fails if the two ever disagree.
const MIN_BODY_FONT_SIZE = { tv: 18, phone: 14 };

module.exports = defineConfig([
  globalIgnores([
    '**/dist/**',
    // Generated, not authored: Expo writes expo-env.d.ts and .expo/ on
    // `expo start`, and Convex writes `_generated` from the schema and function
    // modules (it is committed so CI needs no Convex deployment).
    '**/.expo/**',
    '**/expo-env.d.ts',
    'convex/convex/_generated/**',
    // The incoming Soft Minimal handoff, vendored verbatim so the swap has
    // something to be checked against. It is a specification, not source: it
    // carries its own palette and its own token names, so every Boardwalk rule
    // fires on it by design. Lint it and the only way to pass is to edit the
    // handoff, which would make it useless as a reference.
    'docs/design/soft-minimal/**',
    // Linked git worktrees the agent harness checks out under here for
    // background tasks: a whole second copy of the repo (with its own generated
    // files), gitignored and transient. `eslint .` walks the filesystem, not
    // git, so without this it lints another branch's checkout and fails on it.
    '.claude/**',
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
    plugins: { boardwalk },
    rules: { 'boardwalk/tokens-only': 'error' },
  },

  // Boardwalk's other rule, and the half of it that is config: body text is
  // floored at the smallest size the surface it is read from allows, and this
  // is where the repo says which surface a file stands on. Two blocks and not
  // one, because 14 and 18 are two floors rather than a lax one and a strict
  // one — a repo-wide 18 would be the television's answer written over the
  // phone's, and a repo-wide 14 would un-ban on the TV everything the TV block
  // exists to catch. The rule is handed the whole `MIN_BODY_FONT_SIZE` table
  // either way, so each surface can read the *other's* floor as a number when
  // it is written where it does not belong.
  //
  // Both blocks name a game module's screens by file name, which is the
  // convention every module follows (`tv-screen.tsx` beside
  // `controller-screen.tsx`) and the only handle a config has: a module that
  // drew a screen out of a file named something else would sit outside the
  // gate. What neither block names is `packages/ui`, which both surfaces import
  // — a shared primitive stands on no one surface, so it cannot be given a
  // floor here. None of them sets a `fontSize` today.
  {
    files: ['apps/tv/**/*.ts', 'apps/tv/**/*.tsx', 'packages/games/*/src/tv-*.tsx'],
    plugins: { boardwalk },
    rules: {
      'boardwalk/body-text-floor': ['error', { surface: 'tv', minBodyFontSize: MIN_BODY_FONT_SIZE }],
    },
  },
  // Eyes up, as a gate: the television is the stage and the phones are the
  // controllers, so nothing a TV screen draws may be reachable with the remote.
  // Switched on for exactly the paths the TV floor above covers — the same two
  // globs, because "the TV surface" is one answer and having it written twice
  // differently is how one of them ends up wrong. The Controller is pointedly
  // not among them: its screens are made of controls.
  {
    files: ['apps/tv/**/*.ts', 'apps/tv/**/*.tsx', 'packages/games/*/src/tv-*.tsx'],
    plugins: { huddle },
    rules: {
      'huddle/tv-remote-surface': ['error', { remoteOwner: THE_REMOTE_OWNER }],
    },
  },

  {
    files: [
      'apps/controller/**/*.ts',
      'apps/controller/**/*.tsx',
      'packages/games/*/src/controller-*.tsx',
    ],
    plugins: { boardwalk },
    rules: {
      'boardwalk/body-text-floor': [
        'error',
        { surface: 'phone', minBodyFontSize: MIN_BODY_FONT_SIZE },
      ],
    },
  },
]);
