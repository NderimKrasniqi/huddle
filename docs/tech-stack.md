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
| Android TV | Expo / `react-native-tvos` | Supported | Export, release build, Leanback metadata, animated TV boot, Room Invitation, and display-only game-flow renders |
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
| Expo Camera | `~57.0.3` | Phone QR scanning, permission handling, and native configuration |
| Expo Crypto | `~57.0.1` | Local guest UUID generation |
| AsyncStorage | `~2.2.0` | Non-secret local guest profile |
| Expo SecureStore | `~57.0.1` | Authoritative room session credential |
| React Native Safe Area | `~5.7.0` | Native inset provider |
| React Native Screens | `~4.26.2` | Native navigation screens |
| React Native QR Code SVG | `^6.3.21` | TV Room join-link QR only |
| React Native SVG | `15.15.4` | TV Room QR, TV boot motion, and TV restoration decoration only |

Active renderers use ordinary React Native style objects and system fonts.
`PurposeScreen` remains the neutral baseline, while `@huddle/ui/native` also
exports the pure avatar-art resolver used by Phone and TV. The Phone-owned Join
Room renderer uses built-in React Native image, input, picker, modal, pressable,
activity, keyboard, and scroll primitives plus
`react-native-safe-area-context`; its route adapter owns Convex, profile, and
session effects. The Phone scanner uses the already-configured Expo Camera
module and mounts it only while the modal route is focused. The TV-owned Room
Invitation renderer is the only consumer permitted to import the QR package.
The TV-owned Creating Room boot renderer may use built-in `Animated`/image
primitives and `react-native-svg` for its display-only living-room motion; it has
no QR package, controls, or focus targets. Only the TV app declares QR/SVG
dependencies. The TV-owned restoration renderer uses `Animated`/image
primitives and the same existing SVG runtime for a short, display-only handoff;
it does not query a roster or claim player state.
The TV-owned game-flow renderers use only built-in `Animated`, image, text, and
system-font primitives. They contain no controls, focus targets, QR/SVG
imports, or game rules; Convex and the game registry remain the authority for
the browsing index, setup schema, roster, and readiness. No new package or
custom font is approved for these TV treatments.
NativeWind, Tailwind, CSS interop, custom fonts, Expo Image, Reanimated,
Lucide, NetInfo presentation, and global CSS are not direct workspace
dependencies or active presentation APIs. Phone and TV pin
`react-native-worklets@0.10.1` only to satisfy the Reanimated 4.5.1 native peer
required transitively by Expo Router; Huddle presentation code must not import
Worklets or Reanimated. The architecture validator enforces the exact native
client/version exception and continues to reject source imports.

The TV `ios` and `prebuild` scripts set
`REACT_NATIVE_NODE_MODULES_DIR="$PWD/node_modules"`. This is the
`react-native-svg` podspec escape hatch needed with pnpm and the
`react-native-tvos` alias on Apple prebuilds. It preserves experimental tvOS
compile compatibility; Android TV remains the required runtime proof.

Expo Camera configuration remains in the Phone app and now backs the branded QR
scanner. The scanner accepts only the Huddle deep-link protocol; it never owns
membership or session authority.

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
| Jest + React Native Testing Library | Jest `29.7` | Join Room, TV Creating Room boot, TV restoration, TV Room Invitation, TV game-flow renderers, and remaining purpose-screen checks |
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
pnpm audit:prod
git diff --check
```

## Deterministic simulator workflow

The repository includes a checked-in XcodeBuildMCP configuration at
`.xcodebuildmcp/config.yaml`. Its isolated `phone` and `tvos` profiles point to
the supported iPhone 17 and experimental Apple TV 4K (3rd generation at 1080p)
simulators. The active profile defaults to `phone`; agents can switch to the
`tvos` profile without rediscovering the workspaces or schemes.

For repeatable local runs, use the root scripts:

```sh
pnpm sim:status   # read-only health and artifact report
pnpm sim:phone    # build, install, and launch Phone on iPhone 17
pnpm sim:tv       # start huddle_tv on emulator-5554, then build/install/launch TV
pnpm sim:tvos     # build, install, and launch TV on the experimental tvOS simulator
pnpm sim:all      # run the supported Phone + Android TV pair
```

Every Android TV operation is explicitly scoped to `emulator-5554`; the runner
never uses an unqualified `adb` command and never targets a physical TV. It
verifies that the serial resolves to the `huddle_tv` AVD before installing
anything. The AVD must already exist; if it is closed or fails to boot, the
runner stops after a bounded wait with a retry message instead of hanging. The
runner also expects the generated native projects to be present and reports the
exact prebuild command when one is missing. Add `--dry-run` to inspect the
planned build, install, and launch commands without starting devices or
changing app state.

## Bundle and native release proof

Create fresh export directories and inspect each client bundle:

```sh
pnpm --filter @huddle/phone exec expo export --platform ios --output-dir <phone-ios-export>
pnpm --filter @huddle/phone exec expo export --platform android --output-dir <phone-android-export>
EXPO_TV=1 pnpm --filter @huddle/tv exec expo export --platform android --output-dir <tv-android-export>
pnpm verify:bundle-seam -- <export-directory>
```

The architecture validator checks the exact optimized avatar and TV game-flow
PNG bundles (dimensions and SHA-256 digests). It rejects 4K/2K duplicates,
unused setup art, SVG/font copies, and sample package files.

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

## Dependency Policy

Run `pnpm audit:prod` before release-sensitive dependency changes. Record any
temporary audit exception in the task or pull request that introduces it, with a
review date and removal condition.
