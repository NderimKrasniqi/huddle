# Huddle technology stack

This document records the technology choices used by the integrated Heartbeat
release. Product behavior belongs in [`project-scope.md`](./project-scope.md);
runtime boundaries belong in [`architecture.md`](./architecture.md).

## Supported platform matrix

| Client | Runtime | Status | Remaining proof |
|---|---|---|---|
| iOS Phone | Expo SDK 57 / React Native | Supported | physical Phone party traversal |
| Android Phone | Expo SDK 57 / React Native | Supported | physical QR, reconnect, and game traversal |
| Android TV | Expo SDK 57 / `react-native-tvos` | Supported | physical remote/focus traversal |
| tvOS | Expo / `react-native-tvos` | Experimental | compile/simulator evidence only |

Web, accounts, store submission, production release tooling, and a TV
controller are not supported clients or features.

## Runtime and workspace

| Technology | Version | Responsibility |
|---|---:|---|
| Node.js | `^22.13.0` or `>=24` | repository tooling |
| pnpm | `10.13.1` | workspace installation and scripts |
| TypeScript | `~5.9.3` | strict types |
| React | `19.2.3` | native component runtime |
| Expo | SDK `57` | Phone and TV application platform |
| Expo Router | `~57.0.12` | file-based native routes and deep links |
| React Native TV | `~0.86.0-2` | shared Android TV runtime |
| Convex | `^1.42.3` | authoritative room and game state |

Workspace roots are `apps/phone`, `apps/tv`, `games/*`, `packages/contracts`,
`packages/domain`, `packages/design-tokens`, `packages/ui`,
`packages/game-registry`, and `convex`. Package exports, rather than source
directory reach-through, enforce those boundaries.

## Heartbeat presentation stack

| Technology | Version | Use |
|---|---:|---|
| `@expo-google-fonts/nunito` | `0.4.2` | Nunito 400/700/800 on Phone and TV |
| Expo Camera | `~57.0.3` | Phone QR scanning only |
| React Native QR Code SVG | `^6.3.21` | TV Room Invitation QR only |
| React Native SVG | `15.15.4` | TV QR and decorative boot/restoration marks |
| Safe Area Context | `~5.7.0` | Phone insets and controller layouts |
| Expo Splash Screen | `~57.0.5` | font/frame-coordinated startup |
| Expo Crypto | `~57.0.1` | local guest UUID generation |
| AsyncStorage | `~2.2.0` | non-secret GuestProfileV1 |
| Expo SecureStore | `~57.0.1` | Phone/TV session credentials |

Both Expo layouts call `useFonts` for Nunito and keep the native splash visible
until fonts and the first frame are ready. The shared
`@huddle/design-tokens` package exports the exact board palette, semantic roles,
typography, spacing, radii, shadows, and reduced-motion durations. Shared
`@huddle/ui/native` primitives use ordinary React Native style objects and
retain accessible labels, disabled/busy state, and 44-point Phone targets.

NativeWind, Tailwind, CSS interop, Expo Image, Reanimated, Lucide, NetInfo
presentation imports, and global CSS are intentionally absent. Styling is
tokenized React Native code. `react-native-worklets@0.10.1` is pinned only in
Phone and TV for the Expo toolchain's native compatibility; Huddle source does
not import it.

The TV app owns the only QR/SVG dependencies. The Phone scanner owns the only
`CameraView`. The TV source graph is checked for buttons, inputs, press handlers,
positive focus, and D-pad handlers so the TV remains a passive stage.

## Server and game contracts

| Technology | Version | Use |
|---|---:|---|
| Convex | `^1.42.3` | rooms, seats, presence, setup, readiness, runtime |
| `@convex-dev/rate-limiter` | `^0.4.2` | server-owned party-safe limits |
| Zod | `^4.4.3` | wire and module decoding |
| `convex-test` | `^0.0.54` | in-memory Convex integration tests |

The game registry exposes five ordered catalog entries. Trivia and Voting are
installed modules with complete loops; Doodle Dash, Quick Poll, and Hot Take
are display-only Coming soon entries. Each playable module owns its settings,
server rules, state/deadlines, redaction, Phone controller, TV presentation,
and Back-to-lobby boundary. Convex remains the authority and no new server
schemas are introduced by the design layer.

## Asset and motion pipeline

The retained visual references are the Huddle direction board and approved
screen set under `docs/design/heartbeat/reference/`. The React Native surfaces
have completed their fidelity pass against that set. Runtime artwork is checked into
`packages/ui/assets/heartbeat`; optimized stable avatar IDs are in
`packages/ui/assets/avatars`, and launcher/splash derivatives are in
`packages/ui/assets/app-icons`. These are implementation assets, not source
masters. `tools/validate-architecture.py` validates the
runtime bundle directly for its exact file set, dimensions, alpha, and
SHA-256 digests without requiring a design manifest or source-master tree.

TV uses a 1920×1080 design stage and a 5% overscan-safe frame, scaling down to
1280×720. Phone uses portrait-first Safe Area layouts. Tokenized motion covers
startup orbit, room reveal, card selection, game-world handoff, and success.
Reduced-motion devices get static marks and immediate state changes without
losing status copy or accessibility semantics.

## Verification commands

Fast correctness and boundary checks:

```sh
pnpm typecheck
pnpm lint
pnpm validate:architecture
pnpm validate:game-contracts
pnpm validate:routes
pnpm validate:ui-stack
pnpm verify:bundle-seam -- <fresh-export-directory>
pnpm test:render
```

Convex and content checks remain available through `pnpm test:integration`,
`pnpm validate:rate-limits`, `pnpm validate:guest-profile`, and
`pnpm validate:packs`. Use `git diff --check` before handoff.

For bundle proof, export Phone and TV into fresh directories and run the seam
scanner. For device proof, use the repository's scoped simulator runner:

```sh
pnpm sim:status
pnpm sim:phone
pnpm sim:tv
pnpm sim:all
```

The remaining release gate is real camera permission and QR join, mixed-phone
reconnect/seat loss, physical Android TV remote traversal, and the physical
Phone + Android TV party check.
