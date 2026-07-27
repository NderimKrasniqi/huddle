# Tech Stack — Huddle

TypeScript everywhere: an Expo monorepo (react-native-tvos for the TV app, Expo
for the phone controller), Convex as the authoritative real-time backend, shared
packages for game modules and the protocol.

## Decisions

### Language & Runtime
- **Choice:** TypeScript (strict) — everywhere: TV app, phone app, backend
  functions, game modules.
- **Why:** Scope requires game logic written once and shared between server and
  clients ("clients are renderers"); a single language is what makes game
  modules pure shared packages. Solo dev, one brain, one language.
- **Alternatives considered:** Swift/Kotlin native — rejected: doubles every
  game module and locks out the Android-TV-primary + tvOS-secondary spread from
  one codebase.

### App Framework
- **Choice:** Expo (current SDK) with `react-native-tvos` for the TV app; plain
  Expo for the phone controller. Two apps in one monorepo, `expo-router` for
  navigation in both.
- **Why:** Only stack that targets Android TV + tvOS from one codebase (scope:
  Philips primary, tvOS best-effort) while sharing components with the phone
  apps.
- **Alternatives considered:** Flutter — TV support unofficial/weak; native
  per-platform — cost; web app — rejected earlier by product decision (native
  TV feel, and tvOS has no WebView anyway).

### Monorepo
- **Choice:** pnpm workspaces: `apps/tv`, `apps/controller`, `convex/`,
  `packages/game-core` (module interface, room/event types),
  `packages/games/trivia`, `packages/packs` (question-pack schema + the curated
  pack).
- **Why:** Scope's foundation requirements (game modules beside the platform,
  packs as data) are directory boundaries, enforced from day one. pnpm is free
  and fast; Expo supports it.
- **Alternatives considered:** Turborepo/Nx — build orchestration this size
  doesn't need; single app package — erases the module boundary the scope
  demands.

### Database & Real-time Backend
- **Choice:** Convex — rooms, players, game state, presence; mutations wrap
  game-module reducers; scheduled functions drive round timers.
- **Why:** Scope: server-authoritative state, live TV/phone sync, simultaneous
  answers without races (transactional mutations), ~10 rooms on a free tier.
  Convex is all of that with zero servers to run ("as cheap as possible").
- **Alternatives considered:** Colyseus — needs hosting ($, ops) for latency
  headroom trivia doesn't need; Cloudflare Durable Objects — more assembly
  (presence, persistence, client) for no MVP gain; Firebase — authoritative
  logic awkward, and lock-in without Convex's DX.
- **Notes that cost time if forgotten:**
  - **A new required field will not push onto rows that lack it.** Convex
    validates every existing document against the schema at push time and
    aborts the whole push — functions included — if one fails. The symptom is
    `convex dev` refusing to deploy with a validation error naming the table
    and the field, on a working tree where nothing looks wrong.
  - **It bit once, on `sessionToken`, and is resolved.** Phase 2's rejoin task
    made `players.sessionToken` required while the dev deployment
    `nderim-krasniqi:huddle:dev` still held seven player rows from Phase 1 join
    tests, minted before the field existed; presence then added `lastSeenAt`
    and `away` to the same table before any push had been attempted. Clearing
    `players` once resolved all three at once, and the push then added the
    `by_session_token` index cleanly. Those rows were testing junk — nothing in
    the product outlives a party.
  - **How to clear a table from the CLI**, since the dashboard is not the only
    way: `npx convex import --table <name> --replace -y <file>` with a file
    containing `[]` deletes every row (it reports the delete count before it
    runs). `npx convex data <name>` shows what is there first — look before
    you clear, because this is not reversible.
  - The field stays required rather than optional on purpose: every player row
    is created by `joinRoom`, which always mints a token, so a player without
    one is a player who could never rejoin — a state worth failing on, not one
    worth modelling.

### Authentication
- **Choice:** None. Random session token generated on first join, stored in the
  phone app, identifies the player for rejoin. Host is a flag on a player row.
  The token is minted server-side by `joinRoom` and kept on the phone by
  `expo-secure-store` (iOS Keychain / Android Keystore) — it must outlive a
  force-quit, and it is the one value Huddle holds that acts as a credential.
- **Why:** Scope: no accounts, ephemeral identity, rejoin-with-score-intact. A
  token in app storage is the entire requirement.
- **Alternatives considered:** Convex Auth / Clerk — rejected: nothing to
  protect, pure MVP friction.

### Validation
- **Choice:** Zod — schemas for the question-pack format, game settings, and
  player events; Convex's own validators at function boundaries.
- **Why:** Scope's foundations are *formats* (packs, settings schemas, events);
  Zod makes each format one source of truth that validates at runtime and types
  at compile time. Pack validation runs in CI so a typo'd question can't ship.
- **Alternatives considered:** Hand-rolled checks — drift from types;
  ArkType/Valibot — fine tools, smaller ecosystems, no advantage here.

### UI & Styling
- **Choice:** React Native `StyleSheet` with a shared theme package
  implementing the **Boardwalk design system** (tokens and per-screen specs in
  `docs/design/design-handoff.md`; high-fidelity mock in the claude.ai/design
  project referenced there). Fonts: Bungee (display) + Space Grotesk (body)
  via `@expo-google-fonts`. Hard offset shadows, thick ink borders, sticker
  rotations per the handoff. `react-native-qrcode-svg` for the room QR.
- **Why:** The visual design is a settled input (scope: "Visual design"
  constraint), so the theme package is an extraction job, not invention. Plain
  StyleSheet because heavy styling libraries are untested on
  `react-native-tvos` — and Boardwalk's primitives (borders, offset shadows,
  radii) need nothing more.
- **Alternatives considered:** NativeWind/Tamagui — TV support unproven; risk
  without payoff at this UI scale.

### Linting
- **Choice:** ESLint 9 (flat config) with `eslint-config-expo` — one
  `eslint.config.js` at the repo root covering every workspace package, run as
  `pnpm lint` (`eslint . --max-warnings=0`).
- **Why:** It is the config Expo ships and maintains against the SDK we are on
  (`eslint-config-expo@57` ↔ `expo@57`), so React/hooks/import rules stay
  correct for free. One root config instead of one per package: the apps are
  React Native and everything else is plain TypeScript, which the same config
  covers. `--max-warnings=0` because the Expo config levels most rules at
  "warn", and a gate that exits 0 on warnings is not a gate.
- **Alternatives considered:** Biome — faster, but no Expo-maintained ruleset,
  so React Native correctness rules would be hand-assembled; per-package ESLint
  configs — five copies of the same file.

### Testing
- **Choice & strategy:**
  - **Unit (Vitest):** game-module reducers, scoring modes, pack schema
    validation, host-promotion and rejoin rules — all pure TypeScript, the bulk
    of the suite. This is where trivia's rules live, so this is where
    correctness lives.
  - **Integration (`convex-test`):** Convex functions against the official
    in-memory backend — room creation, join/rejoin with token, simultaneous
    answer mutations, timer-driven round advance. Real function runtime, no
    network.
  - **End-to-end: deliberately none automated.** TV+phones e2e (Detox on
    Android TV) is high-cost/low-yield at this scale; the real e2e is a
    play-test session on the Philips with friends, treated as a release gate,
    not a test suite.
  - **Deliberately untested:** RN component rendering/snapshots (churn without
    confidence), visual layout (play-test catches it).
  - **CI:** GitHub Actions free tier (`.github/workflows/ci.yml`) — typecheck,
    lint, unit (`pnpm test:unit`), integration (`pnpm test:integration`) on
    every push, as four named steps sharing one checkout and one install. It
    runs off the committed `convex/convex/_generated` files, so no Convex
    deployment and no secrets are involved. Pack validation joins the gates in
    Phase 4, when the Question Pack schema exists.
- **Why:** Solo + cheap: the suite must run in seconds locally and free in CI,
  and concentrate on the shared logic that every client depends on.

### Deployment & Hosting
- **Choice:** Convex cloud free tier (backend). Local builds: Android Studio →
  APK sideloaded to the Philips TV and Android phones; Xcode → TestFlight for
  iOS controller. No EAS paid plan.
- **Why:** Scope: as cheap as possible; ~$99/yr total (Apple). Sideloading
  gives same-day TV builds with no store review.
- **Alternatives considered:** EAS Build — convenient but paid/queued; revisit
  if local builds become a time sink.

### Local Toolchain
- **Choice:** Homebrew for both halves. Apple: Xcode 26.5 with the iOS and tvOS
  simulators. Android: `brew install openjdk@17` plus the
  `android-studio` and `android-commandlinetools` casks, with the SDK
  provisioned by `sdkmanager` into `~/Library/Android/sdk` — platform-tools 37,
  emulator 36.6.11, platforms 35 and 36, build-tools 35.0.0 and 36.0.0, and the
  `system-images;android-36;android-tv;x86_64` TV image. Gradle pulls NDK
  27.1.12297006 itself on the first build, which only succeeds because the SDK
  licences were accepted up front (`sdkmanager --licenses`).
- **Why:** the command-line tools are what makes the Android setup scriptable
  and reproducible, and Android Studio is kept alongside them for the GUI that
  a headless CLI cannot give — logcat, the layout inspector, and the AVD
  manager — which the Philips TV work will want.
- **Notes that cost time if forgotten:**
  - `openjdk@17` is keg-only, so `JAVA_HOME` must be set explicitly to
    `/usr/local/opt/openjdk@17`; `/usr/libexec/java_home` will not find it.
    Both it and `ANDROID_HOME` are exported from `~/.zshrc`.
  - The emulator AVD is `huddle_tv`, on the `tv_1080p` profile. Wait for
    `adb shell getprop sys.boot_completed` to return `1` before building —
    `expo run:android` fails outright against a device that is merely
    *attached*, not booted.
  - **A config change needs `prebuild --clean`.** `expo run:android` reuses an
    existing `android/` and does not re-apply config plugins, so it will build
    and install happily while silently ignoring the change — the symptom is a
    green build that behaves exactly as before. `pnpm --filter @huddle/tv
    prebuild --platform android --clean` is what actually regenerates it;
    verify against `android/app/src/main/res/values/` rather than trusting the
    build.
  - `reactNativeArchitectures` defaults to all four ABIs. Exporting
    `ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64` builds only what the
    emulator can run; the full set is only needed for the Philips TV (arm64)
    and is much slower. A clean x86_64-only debug build is ~10 minutes.
  - Only `android-36` ships a 64-bit Android TV image, so on an Intel Mac the
    emulator runs an API level well above the real Philips target. See the
    caveats on the toolchain task in implementation-plan.md.

### Notable Libraries
- `expo-camera` — QR scan on the phone for joining (with manual room-code entry
  as fallback).
- `convex/react` — live queries; the entire client data layer.
- `expo-secure-store` — the Controller's Session Token across launches (see
  Authentication above).
- `react-native-qrcode-svg` — QR render on the TV.
