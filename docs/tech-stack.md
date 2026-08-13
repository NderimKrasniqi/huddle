# Huddle technology stack

This document owns the approved technologies, pinned versions, platform
caveats, and verification commands. Runtime boundaries and dependency direction
belong in [`architecture.md`](./architecture.md); product behavior belongs in
[`project-scope.md`](./project-scope.md).

## Supported platform matrix

| Client | Runtime | Milestone status | Required proof |
|---|---|---|---|
| iOS Phone | Expo / React Native | Supported | Export, native identity, camera permission, QR join, full room loop |
| Android Phone | Expo / React Native | Supported | Export, native identity, manual and QR join, full room loop |
| Android TV | Expo / `react-native-tvos` | Supported | Export, release build, Leanback metadata, remote-focus check, full room loop |
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
| Expo Router | `~57.0.8` | File-based native navigation and modal/deep-link routing |
| React Native TV | `~0.86.0-2` | Single React Native runtime with Android TV support |

The workspace roots are `apps/*`, `packages/*`, `games/*`, and `convex`.
Applications consume contracts, domain rules, tokens, registry entries, shared
UI, and game modules through package exports; they do not reach across package
source directories.

## Client platform libraries

| Technology | Approved version | Use |
|---|---:|---|
| NativeWind | `4.2.1` | Active component styling system |
| Tailwind CSS | `3.4.17` | NativeWind compilation and the shared semantic preset |
| Reanimated | `4.5.1` | UI-thread animation |
| Worklets | `0.10.1` | Reanimated worklet runtime |
| Expo Image | `~57.0.2` | All application image rendering |
| NetInfo | `~12.0.1` | Advisory offline and retry presentation |
| Expo Camera | `~57.0.3` | Phone QR scanner in QR-only mode |
| Expo Crypto | `~57.0.1` | Local guest UUID generation |
| AsyncStorage | `~2.2.0` | Non-secret local guest profile |
| Expo SecureStore | `~57.0.1` | Authoritative room session credential |

NativeWind configuration is app-owned. Each app provides Babel and Metro
configuration, a CSS entrypoint imported by its root layout, NativeWind type
declarations, and Tailwind content paths covering the app, shared UI, registry,
and `games/*`. `@huddle/design-tokens` owns the canonical Soft Minimal values
and preset.

Visual constants must use semantic tokens. Calculated layout and animated
values may remain native style objects when their constants resolve through
tokens. ESLint and architecture validation reject active imports of React
Native `StyleSheet`, `Image`, `ImageBackground`, and `Animated`.

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
| Jest + React Native Testing Library | Jest `29.7` | Rendered Phone and TV component checks |
| ESLint | `9.39` | TypeScript, React, semantic-token, typography, accessibility, and TV-surface rules |
| Maestro | `2.8.0` | Repeatable installed-app journeys on simulators and connected devices |
| Expo export / Metro | SDK `57` | Platform bundle proof and bundle-seam inspection |
| Xcode / Gradle | Project-native | Native compile, identifiers, entitlements, and launcher metadata |

Maestro is part of the release proof, not the unit-test layer. Run flows against
an installed development build with a specific device ID:

```sh
MAESTRO_CLI_NO_ANALYTICS=1 maestro --device <device-id> test <flow.yaml> --no-ansi
```

Use Maestro for deterministic navigation, manual-code joining, Ready/start/end,
recovery, and focus assertions. A simulator flow can prove camera permission and
scanner fallback UI, but it cannot prove a physical phone reading the TV's real
QR code. That camera path and Android TV remote focus still require dated
physical-device evidence.

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

Create fresh export directories and inspect every client bundle:

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
non-required, provide TV icon and banner resources, and expose
`LEANBACK_LAUNCHER`. Android TV build failure blocks the milestone. tvOS build
or simulator failure is recorded separately because tvOS remains experimental.

Phone configuration must resolve to slug `huddle-phone`, package
`tv.huddle.phone`, and iOS bundle identifier `tv.huddle.phone`. Before deep-link
testing, remove earlier Huddle builds from test devices so `huddle://`
resolution is unambiguous.

## Dependency policy

Current audit exceptions, patches, review dates, and production dependency
policy are owned by [`dependency-security.md`](./dependency-security.md). Do not
copy advisory lists into this document.
