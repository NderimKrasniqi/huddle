# Huddle technology stack

This document owns approved technologies, pinned versions, platform caveats,
and verification commands. Runtime boundaries and dependency direction belong
in [`architecture.md`](./architecture.md); product behavior belongs in
[`project-scope.md`](./project-scope.md).

## Supported platform matrix

| Client | Runtime | Milestone status | Required proof |
|---|---|---|---|
| iOS Phone | Expo / React Native | Supported | Export, native identity, illustrated Join Room render |
| Android Phone | Expo / React Native | Supported | Export, native identity, illustrated Join Room render |
| Android TV | Expo / `react-native-tvos` | Supported | Export, release build, Leanback metadata, neutral baseline render |
| tvOS | Expo / `react-native-tvos` | Experimental | Compile and simulator evidence only |

Web is not a supported client. Store submission and production release tooling
are outside this milestone.

## Runtime and workspace

| Technology | Approved version | Responsibility |
|---|---:|---|
| Node.js | `^22.13.0` or `>=24` | Toolchain and repository scripts |
| pnpm | `10.13.1` | Workspace installation, filtering, and scripts |
| TypeScript | `~5.9.3` | Strict types across apps, packages, games, and Convex |
| React | `19.2.3` | Shared component runtime |
| Expo | SDK `57` | Phone and TV application platform |
| Expo Router | `~57.0.12` | File-based native navigation and deep-link routing |
| React Native TV | `~0.86.0-2` | One React Native runtime with Android TV support |

Workspace roots are `apps/*`, `packages/*`, `games/*`, and `convex`.
Applications consume contracts, domain rules, the registry, shared neutral UI,
and game modules through package exports; they do not reach across package
source directories.

## Active client libraries

| Technology | Approved version | Use |
|---|---:|---|
| Expo Camera | `~57.0.3` | Retained Phone QR-scanning capability and native configuration |
| Expo Crypto | `~57.0.1` | Local guest UUID generation |
| AsyncStorage | `~2.2.0` | Non-secret local guest profile |
| Expo SecureStore | `~57.0.1` | Authoritative room session credential |
| React Native Safe Area | `~5.7.0` | Native inset provider |
| React Native Screens | `~4.26.2` | Native navigation screens |

Active renderers use ordinary React Native style objects and system fonts.
`@huddle/design-tokens` contains only the white/black values used by the shared
clean-slate baseline, and `PurposeScreen` remains the only renderer exported by
`@huddle/ui/native`. The Phone-owned Join Room renderer uses built-in React
Native image, input, pressable, activity, keyboard, and scroll primitives plus
`react-native-safe-area-context`; it adds no presentation dependency.
NativeWind, Tailwind, CSS interop, custom fonts, Expo Image, Reanimated,
Worklets, Lucide, NetInfo presentation, SVG renderers, QR renderers, and global
CSS are not direct workspace dependencies or active presentation APIs. Expo
Router may retain framework-transitive peer entries in the lockfile; they are
not imported by Huddle presentation code.

Expo Camera configuration remains deliberately present even though the Join
Room QR action currently opens a modal purpose-label screen that does not mount
a camera. This keeps the platform capability and native boundary ready for a
later scanner slice.

## Server and shared contracts

| Technology | Approved version | Use |
|---|---:|---|
| Convex | `^1.42.3` | Authoritative room, membership, presence, lifecycle, and game state |
| `@convex-dev/rate-limiter` | `^0.4.2` | Server-owned party-safe token buckets |
| Zod | `^4.4.3` | Wire and game-module runtime decoding |
| `convex-test` | `^0.0.54` | In-memory Convex integration tests |

Convex session credentials are the only membership authority. Guest IDs are
non-secret metadata. Heartbeats, scheduled callbacks, and maintenance remain
outside command rate buckets.

## Verification tooling

| Tool | Baseline | Purpose |
|---|---:|---|
| Vitest | `4.1.10` | Domain, contracts, games, apps, and Convex tests |
| Jest + React Native Testing Library | Jest `29.7` | Join Room behavior/accessibility and Phone/TV purpose-screen render checks |
| ESLint | `9.39` | TypeScript and forbidden presentation-boundary imports |
| Expo export / Metro | SDK `57` | Platform bundle proof and bundle-seam inspection |
| Xcode / Gradle | Project-native | Native compile, identifiers, and launcher metadata |

## Local verification ladder

Run the fast correctness gates first:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:render
```

Then run repository and product-specific gates:

```sh
pnpm validate:workflow
pnpm validate:architecture
pnpm validate:game-contracts
pnpm validate:routes
pnpm validate:native-identity
pnpm validate:boundaries
pnpm validate:ui-stack
pnpm validate:rate-limits
pnpm validate:guest-profile
pnpm validate:packs
pnpm verify:dependency-security
pnpm audit:prod
git diff --check
```

## Bundle and native release proof

Create fresh export directories and inspect each client bundle:

```sh
pnpm --filter @huddle/phone exec expo export --platform ios --output-dir <phone-ios-export>
pnpm --filter @huddle/phone exec expo export --platform android --output-dir <phone-android-export>
EXPO_TV=1 pnpm --filter @huddle/tv exec expo export --platform android --output-dir <tv-android-export>
pnpm verify:bundle-seam -- <export-directory>
```

Generate and inspect Android TV metadata, then compile a release artifact:

```sh
pnpm --filter @huddle/tv prebuild --platform android --no-install
NODE_ENV=production ./apps/tv/android/gradlew -p apps/tv/android assembleRelease
```

The Android manifest must require Leanback, make touchscreen/faketouch
non-required, provide the neutral TV icon and banner resources, and expose
`LEANBACK_LAUNCHER`. Android TV build failure blocks the milestone. tvOS
failure is recorded separately because tvOS remains experimental.

Phone configuration must resolve to slug `huddle-phone`, package
`tv.huddle.phone`, and iOS bundle identifier `tv.huddle.phone`. Before
deep-link testing, remove earlier Huddle builds from test devices so
`huddle://` resolution is unambiguous.

## Dependency policy

Current audit exceptions, patches, review dates, and production dependency
policy are owned by [`dependency-security.md`](./dependency-security.md). Do
not copy advisory lists into this document.
