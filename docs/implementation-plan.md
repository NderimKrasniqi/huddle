# Huddle Heartbeat implementation plan

## Execution state

**Current phase:** React Native visual and simulator/emulator fidelity complete;
physical party check pending

**Runtime milestone:** the platform/game behavior and Phone-controller /
TV-stage handoff are implemented. The saved Huddle direction board and approved
screen boards in `docs/design/heartbeat/reference/approved-screens/` are the
visual references. The React Native implementation has completed its
screen-by-screen fidelity pass against them on iPhone Simulator and Android TV
Emulator. Runtime artwork remains checked-in implementation artwork rather than
source-master design material.

## Completed implementation

### 1. Heartbeat foundation — complete

- [x] Exact board palette and semantic tokens in `@huddle/design-tokens`.
- [x] Nunito Regular, Bold, and ExtraBold pinned at `0.4.2` and loaded before
  the native splash hides on Phone and TV.
- [x] Shared native shell, text, buttons, code tiles, portraits, player rows,
  badges, chips, game cards, loading mark, status surfaces, and artwork map.
- [x] Temporary Huddle brand derivatives, ten stable avatar assets, phone
  environments, TV stage, five text-free game cards, and Trivia/Voting game
  worlds are available to the runtime.
- [x] Review the React Native brand, screen composition, and artwork screen by
  screen against the approved reference boards; repair any fidelity gaps found.
- [x] Tokenized motion with static reduced-motion fallbacks and TV
  1920×1080/1280×720 overscan-safe composition.

### 2. Phone platform lifecycle — complete

- [x] Root session provider for credential restoration, active seat, notices,
  remembered profile, join handoff, leave, and seat-loss recovery.
- [x] Root room-code screen with authoritative `joinAvailability` checks and
  inline missing/full-room errors.
- [x] Dedicated `/join/[code]` Pick your vibe identity route with remembered
  profile, claimed-avatar disabling, authoritative join, persistence, and
  replacement navigation. Same-room deep links are suppressed; different-room
  links require an authoritative leave confirmation before identity can join.
- [x] `/scan` modal camera route with permission, malformed-code, duplicate,
  unavailable-camera, and manual-entry recovery states.
- [x] Host/player lobby, live roster, presence/Ready state, Host transfer and
  remove confirmations, Leave, synchronized picker, setup, locked readiness,
  Start gating, pause, unavailable, finished, recovery, Host Back to room from
  picker/setup, and Back to lobby from a running or finished game.

### 3. TV platform lifecycle — complete

- [x] Orbit loading mark, warm living-room boot, restore handoff, and static
  reduced-motion fallback.
- [x] Room Invitation with native Huddle mark, authoritative code, native QR,
  and live ten-seat avatar roster arranged in two rows of five.
- [x] Five-game registry carousel in the exact order Trivia, Voting, Doodle
  Dash, Quick Poll, Hot Take; the five-game registry is shown through a
  three-card viewport with the selected card centered, larger, and visually
  forward, plus one neighboring card on each side. Only the first two are
  selectable.
- [x] Display-only art reveal, module-declared setup projection, roster
  readiness, paused/unavailable/finished/device-failure status surfaces, and
  1920×1080 overscan-safe scaling.

### 4. Playable modules — complete

- [x] Trivia question → private answer/lock → TV reveal/standings → next
  question → final standings loop, with Flat/Speed scoring and its declared
  Questions, Difficulty, Timer, Category, and Scoring settings.
- [x] Voting prompt → private choice/lock → waiting or live aggregate → TV
  reveal → next round → non-scored room-vibe recap loop, with Rounds, Timer,
  Results, and Voter-label settings.
- [x] Per-action busy guards, authoritative event/deadline handling, stale
  event rejection, pause/recovery, and Host-only Back to lobby.
- [x] Redacted Phone/TV projections: private controls stay on the owner Phone;
  TV receives shared prompts, participation, aggregates, reveals, and recap
  only. Future prompts, raw mappings, timings, and pre-reveal answer keys stay
  server-side.
- [x] Legacy persisted `entered` records remain safely decodable without being
  silently reinterpreted as playable state.

### 5. Cleanup and architecture guardrails — complete

- [x] Removed the obsolete neutral purpose renderer and combined legacy join
  adapter, tests, exports, and duplicate Phone/TV asset trees.
- [x] Validator checks the exact Heartbeat palette, runtime asset set,
  dimensions/alpha/digests, native identity derivatives, QR/camera scope, TV
  display-only source, bundle boundaries, and absent NativeWind/Tailwind setup
  without requiring a design manifest or source-master tree.
- [x] Approved visual references are the retained `heartbeat-direction.png`
  board and `approved-screens/` inventory; generated sources outside that set
  are not treated as masters.
- [x] Client seam protects both Trivia content and Voting prompts from client
  runtime graphs and exported bundles.

## Remaining release work

### 6. Fresh bundle and static evidence — complete

- [x] Export Phone (iOS/Android) and TV (Android) into fresh directories.
- [x] Run `pnpm verify:bundle-seam -- <export-directory>` for each export and
  retain the output with the release evidence.
- [x] Capture the iPhone room-code/scanner surfaces and Android TV Room
  Invitation at representative simulator/emulator sizes.
- [x] Capture synchronized Phone identity/lobby/picker/setup/readiness and TV
  roster/carousel/setup/readiness surfaces.
- [x] Capture the two-player Trivia and Voting runtime/final surfaces on Phone
  and TV. Recovery and reduced-motion behavior remain covered by focused
  render/motion checks; physical-device observation stays in the party check.

### 7. Simulator/emulator traversal — complete

- [x] Build, install, and launch the iPhone 17 Release app; exercise the
  Heartbeat room-code screen and QR scanner/manual fallback in runtime
  traversal.
- [x] Traverse the iPhone identity, Host lobby, synchronized picker, Trivia
  setup lock, Ready toggle, minimum-player Start gate, and confirmed
  authoritative Back-to-room against Android TV.
- [x] Verify same-room deep links return to the active seat and different-room
  deep links stop on the explicit handoff confirmation without leaving.
- [x] Complete the two-seat iPhone flow for Host transfer/removal, Trivia,
  Voting, and Back to lobby. Live QA exposed a stale picker after Host return;
  the server now clears game/setup/browse state atomically and the Phone clears
  stale local picker state from authoritative projections. Focused server and
  Phone regressions cover the repaired return path.
- [x] Build the Android TV x86_64 Release APK, install it on the dedicated
  `huddle_tv` AVD, launch through Leanback, and exercise Room Invitation in
  runtime traversal.
- [x] Build the Android Phone Release APK. The product owner accepted the
  Android Phone install/traversal checkpoint after the dedicated emulator
  stalled during installation; this item is closed by direction rather than
  recorded as captured device evidence.
- [x] Verify Android TV has no remote focus target or hidden control and that
  room code, QR, roster, prompts, timer, and recap stay inside overscan-safe
  bounds.

### 8. Physical party check and review — pending

- [ ] Test a real camera permission and QR join with a mixed iOS/Android Phone
  group.
- [ ] Exercise ten-seat roster, Host transfer/removal, away/Ready, seat loss,
  reconnect, both game loops, and Host return-to-lobby on physical devices.
- [ ] Complete the mixed physical Phone + Android TV living-room check.
- [x] Complete the first independent review and repair its Trivia privacy,
  picker return, join handoff, navigation-motion, and contact-sheet findings.
- [x] Obtain follow-up independent approval against the repaired implementation.

## Validation ledger

Focused implementation checks pass for contracts, Convex integration,
Trivia/Voting logic, Phone/TV render suites, typecheck, lint, client seam,
architecture fixtures, architecture/routes/UI-stack validation, and
`git diff --check`. Fresh Phone iOS/Android and TV Android exports pass the
bundle scanner. The iPhone Release app and Android TV Release APK both build,
install, launch, and pass synchronized join, roster, picker, setup, Ready,
two-player Trivia/Voting, Host transfer/removal, and TV display-only inspection.
The Android Phone Release APK also builds successfully; device traversal was
accepted without new captured evidence by product-owner direction after the
test emulator stalled during installation. The Back-to-lobby repair passes its
focused Convex and Phone regressions. Independent re-review previously approved
the room-handoff availability gate and complete Trivia/Voting TV accessibility
summaries after 18 focused render cases passed. Recovery/reduced-motion physical
observation and the mixed physical party check remain open.

## Non-negotiable constraints

- Do not change Convex schema, session-token authority, room lifecycle, stable
  avatar IDs, or the `GameModule` client/server seam.
- TV remains presentation-only; Phone remains the controller.
- Do not add Invite Friend, a web client, fake settings, or playable cards for
  Doodle Dash, Quick Poll, or Hot Take.
- Keep private player choices/timing and unrevealed game content off the TV
  and out of other players' Phone projections.
