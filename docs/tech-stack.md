# Huddle technology stack

This document records the technology choices used by the Playroom release. Product behavior belongs in [`project-scope.md`](./project-scope.md);
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

## Playroom presentation stack

| Technology | Version | Use |
|---|---:|---|
| `@expo-google-fonts/nunito` | `0.4.2` | Nunito 400/700/800/900 on Phone and TV |
| React Native Reanimated | `4.5.1` | platform motion in both apps and `@huddle/ui` |
| Expo Haptics | `~57.0.3` | Phone selection, ready and countdown haptics |
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
`@huddle/design-tokens` package exports the Playroom palette, avatar circle
colours, type scales, spacing, radii, shadows, and motion timings. Shared
`@huddle/ui/native` pieces use ordinary React Native style objects and retain
accessible labels, disabled/busy state, and 48-point Phone targets.

Reanimated drives press feedback, entrances, badges, row highlights and the
ready lift, and respects the system reduced-motion setting. It is used in the
apps and `@huddle/ui`, never in game modules; games import the neutral
`@huddle/ui/game-kit` entry, which does not load it. NativeWind, Tailwind, CSS
interop, Expo Image, Lucide, NetInfo presentation imports, and global CSS are
intentionally absent. Styling is tokenized React Native code.

The TV app owns the only QR/SVG dependencies. The Phone scanner owns the only
`CameraView`. The TV source graph is checked for buttons, inputs, press handlers,
positive focus, and D-pad handlers so the TV remains a passive stage.

## Server and game contracts

| Technology | Version | Use |
|---|---:|---|
| Convex | `^1.42.3` | rooms, seats, presence, setup, readiness, runtime |
| `@convex-dev/rate-limiter` | `^0.4.2` | server-owned party-safe limits |
| Zod | `^4.4.3` | wire and module decoding |

The game registry lists the installed games: Trivia and Bomb Squad. Each module owns its settings,
server rules, state/deadlines, redaction, Phone controller, TV presentation,
and Back-to-lobby boundary. Convex remains the authority; the only schema
addition is the optional countdown state on setup.

## Asset and motion pipeline

The visual reference is the Playroom design under `docs/design/playroom/`.
Platform artwork is checked into `packages/ui/assets/playroom` (avatars, game
art, props, setting icons, status illustrations, brand); each game keeps its
world art in its own `assets/`; launcher and splash derivatives are in
`packages/ui/assets/app-icons`, produced by `tools/generate-app-icons.py` from
the supplied Huddle-Platform app artwork. These are implementation assets, not
source masters. `tools/validate-architecture.py` validates each runtime bundle
directly for its exact file set, dimensions, alpha, and SHA-256 digests
without requiring a design manifest or source-master tree.

TV uses a 1920×1080 design stage and a 5% overscan-safe frame, scaling down to
1280×720. Phone uses portrait-first Safe Area layouts. Motion stays under
300 ms: presses, entrances, card selection, badges, the ready lift, and one pop
per countdown number. Reduced-motion devices get immediate state changes or
brief fades without losing status copy or accessibility semantics.

## Local backend

`pnpm dev:local` runs Convex on this Mac instead of the cloud dev deployment,
and starts both Metro servers against it. Local function calls and database
bandwidth do not count against the Convex plan, so use it for simulator work
and bot-driven test games. The iPhone simulator reaches it directly and the TV
emulator through `adb reverse`; real devices cannot, and keep the cloud URL in
the apps' env files. The script restores the Convex env file to the cloud selection
when it stops, so `convex dev --once` still deploys to the cloud.

## Verification commands

Fast correctness and boundary checks:

```sh
pnpm typecheck
pnpm lint
pnpm validate:architecture
pnpm validate:workflow
pnpm validate:packs
pnpm verify:bundle-seam -- <fresh-export-directory>
```

The project keeps end-to-end tests only; there are no unit, render or
integration suites. The Maestro flows live in `e2e/`; `pnpm e2e:bomb-squad`
seeds a room through `convex/e2e/seed-bomb-room.mjs` and plays the phone from
join to the first bomb on the iPhone simulator. Use `git diff --check` before handoff.

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
