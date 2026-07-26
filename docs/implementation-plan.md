# Implementation Plan — Huddle

## Working Principles
- Vertical slices: every phase ends with something working end-to-end.
- Spec first: no task starts without acceptance criteria.
- Test first: each task's acceptance criteria become tests before code.
- Domain language: names in code mirror the terms in project-scope.md and
  docs/CONTEXT.md.
- Foundation rule: hub code never imports from a game module except through the
  game-core interface; games never import hub internals.
- Design rule: all styling comes from the Boardwalk theme package
  (docs/design/design-handoff.md is the spec); no hex value outside it.

## Definition of Done
A task is done when its acceptance criteria pass as tests (unit/integration per
tech-stack.md; device-visible criteria verified manually on dev builds). A
phase is done when its slice works end-to-end and is tested.

## Pinned Defaults
4-letter room codes (A–Z) · 10-player cap (per-game property; trivia: 2–10) ·
20s question timer · 10-minute room expiry · answers lock on tap · speed
scoring `100 + round(100 × secondsRemaining / 20)`.

## Phase 1 — Walking skeleton: a room you can join
Goal: TV shows a room; a phone joins it; the name appears on the TV. All
plumbing (monorepo, Convex, both apps, theme, CI) exists.
- [x] Monorepo scaffold (pnpm workspaces: `apps/tv`, `apps/controller`,
  `convex/`, `packages/ui`, `packages/game-core`, `packages/games/trivia`,
  `packages/packs`) — AC: `pnpm install && pnpm typecheck` passes from the
  root; both apps boot to a placeholder screen in dev mode.
- [x] Boardwalk theme package (`packages/ui`: color tokens, radius/border
  scales, offset-shadow helper, Bungee + Space Grotesk via
  `@expo-google-fonts`) — AC: both apps render a sample screen using only
  theme tokens; no hex color literal exists outside `packages/ui`.
- [x] CI pipeline (GitHub Actions: typecheck, lint, unit, integration) — AC: a
  push with a deliberately failing unit test fails CI; a clean push passes.
  Verified locally only — see the GitHub repository task below.
- [x] GitHub repository & first CI run (the plan assumed a remote existed; it
  did not) — AC: a private repo exists with `main` pushed; the workflow is
  scheduled by a real push and goes green; a push with a deliberately failing
  unit test goes red. Requires the user — creating a repo is theirs to
  authorise.
- [x] Room creation in Convex — AC: `createRoom` returns a room with a unique
  4-letter code (A–Z, e.g. `KWRD`); creating 2 rooms yields different codes;
  integration test.
- [x] TV pairing screen — AC: TV app on launch auto-creates a room and renders
  the handoff's pairing screen: 4 code-letter tiles, "GRAB YOUR PHONE!" badge,
  QR card encoding `huddle://join/<code>`, footer "0 of 10 joined"; copy
  never references huddle.tv. Code verified, never rendered: this machine has
  Command Line Tools only, so no simulator exists to see it on. Every
  measurement matches the handoff and the copy is confirmed in the shipped
  bundle, but whether it *looks* right is open — see Phase 5's design fidelity
  pass and real-device builds.
- [ ] Joining a room: server rules & TV roster (split from "Phone join by
  code", which bundled six criteria across the backend, the controller UI and
  the TV) — AC: `joinRoom` adds a player to a room by code and the TV roster
  shows the nickname within 1s; a nonexistent code is rejected "room not
  found"; a nickname already taken in that room is rejected "name taken"; an
  11th player is rejected "room full"; each rule has an integration test, and
  the cap and duplicate checks hold against simultaneous joins rather than
  only sequential ones.
- [ ] Phone join screen (the other half of the split) — AC: join screen per
  handoff (code tiles auto-advance per letter, name input); entering code +
  nickname adds the player and shows the "You're in" screen; the three
  server rejections surface as the handoff's error copy.
- [ ] Phone join by QR — AC: scanning the TV's QR opens the join screen with
  the code prefilled; only the nickname remains to type.

## Phase 2 — A room that survives a party
Goal: identity, Host, disconnects, and expiry behave like scope demands;
demoable by force-quitting apps mid-lobby.
- [ ] Session token rejoin — AC: player force-quits and reopens the app → back
  in the room as the same player (same player row, same nickname); the roster
  never shows a duplicate.
- [ ] Presence & away badge — AC: phone backgrounded ≥10s → TV roster marks
  that player "away" within a further 5s; foregrounding clears it within 5s;
  active players show the green status dot per the handoff.
- [ ] Host role & auto-transfer — AC: first player to join is flagged Host
  (HOST pill on TV card and roster row) and their phone shows host controls;
  Host disconnects → the longest-connected active player becomes Host within
  15s; original host rejoins → they are a regular player.
- [ ] Color claim — AC: the "You're in" screen shows 10 swatches (palette
  extends the Boardwalk accents to 10 distinct player colors in
  `packages/ui`); tapping claims the color server-side; two players cannot
  hold the same color (claimed swatches render at 30% opacity); TV card shows
  a circle of the claimed color with Bungee initials; a newly joined player's
  TV card holds the pink "JUST JOINED!" treatment for ~4s.
- [ ] TV room-open resilience — AC: a TV that launches before the backend is
  reachable recovers on its own, with no human touching the remote (the TV app
  is defined as untouched after launch); `openRoom` already clears its memo on
  failure, so this is a caller that retries with backoff, plus a visible
  "reconnecting" state; a missing `EXPO_PUBLIC_CONVEX_URL` surfaces as that
  same readable failure rather than throwing at module import, which currently
  crashes the app at launch.
- [ ] Room expiry — AC: last player disconnects → after 10 minutes with no
  rejoin, the room and its players are deleted (integration test with mocked
  clock); the TV returns to a fresh pairing screen.

## Phase 3 — Trivia, minimal loop: the platform is born
Goal: a complete playable trivia game with flat scoring on a small inline
question set — and the game-module interface exists because trivia is behind
it.
- [ ] Game-module interface in `game-core` — AC: interface exposes metadata
  (id, title, key-art treatment, player range, est. duration, category),
  settings schema, initial-state factory, `reduce(state, event)`, and TV/phone
  screen components; the hub renders purely from the registry (trivia is the
  only entry); a compile-time test instantiates a dummy module against the
  interface.
- [ ] Room state machine & game lifecycle — AC: room states are `lobby →
  in-game → lobby`; Host selects trivia and starts → TV and all phones switch
  to trivia screens within 1s; Host "End game" mid-game → everyone returns to
  the lobby, room intact.
- [ ] Synced game carousel — AC: host phone prev/next (or swipe) updates
  `browsingGameIndex` in room state; the TV carousel follows within 250ms
  (focused card treatment per handoff); non-host phones show "Now viewing
  <Game>"; renders correctly with the registry's single MVP entry.
- [ ] Trivia reducer with flat scoring — AC (unit tests, using a 3-question
  inline set): each question presents 4 options with exactly 1 correct; a
  correct answer scores +100, wrong or no answer +0; with players A and B
  where A answers 3/3 correctly and B answers 1/3, final scores are A=300,
  B=100; after the last reveal the game emits a finished state ordered A, B.
- [ ] Phone answer screen — AC: 4 large buttons matching the TV's option
  colors/shapes; tapping locks the answer (buttons disable, "locked in"
  shown); a second tap changes nothing; answering before the question is
  shown is impossible.
- [ ] TV question & reveal screens — AC: TV shows question, 4 options, and how
  many players have answered ("3/5 answered"); when all active players have
  answered, reveal shows the correct option and per-player correctness; then
  the running scoreboard for 5s; then the next question.
- [ ] Victory & return to lobby — AC: after the last question the TV shows
  final standings (winner celebrated, ties share the top rank); Host's "Back
  to lobby" returns everyone to the lobby with the same roster.

## Phase 4 — Full trivia: packs, timers, settings
Goal: trivia as scoped — curated pack, countdowns, host-tunable settings —
ready for a real game night.
- [ ] Question-pack format & curated pack — AC: Zod schema for pack (id,
  title, version, questions[text, 4 options, correctIndex, category,
  difficulty]); a malformed pack fails `pnpm validate:packs` and CI; the
  shipped curated pack passes and contains ≥100 questions across ≥4
  categories.
- [ ] Question timer — AC: each question runs a 20s countdown shown on the TV;
  players who haven't answered when it expires score +0 for that question;
  reveal triggers at expiry or when all active players have answered,
  whichever comes first (integration test with mocked scheduler).
- [ ] Settings schema & lobby settings UI — AC: trivia declares settings
  {scoring: flat|speed (default flat), questionCount: 5|10|20 (default 10),
  category: all|<pack categories> (default all)}; the Host phone renders this
  UI generically from the schema; a non-Host phone never sees settings
  controls; a started game uses exactly the chosen settings (e.g. category
  "Movies" yields only Movies questions, count 5 yields exactly 5).
- [ ] Speed scoring mode — AC (unit tests): correct answer scores
  `100 + round(100 × secondsRemaining / 20)`; e.g. correct with 15s left
  = 175, correct at 0s left = 100, wrong at any time = 0; flat mode unchanged
  at 100.
- [ ] Away players in-game — AC: an away player is excluded from "3/5
  answered" denominators; their scoreboard row shows the away badge; a player
  who returns mid-question may answer that question if its timer is still
  running.

## Phase 5 — Party-ready
Goal: the app matches the Boardwalk design on real hardware; a full game night
runs without touching a dev tool.
- [ ] Design fidelity pass — AC: hub screens (pairing, join, lobby ×3,
  carousel ×3) spot-checked side-by-side against the Boardwalk mock; trivia
  screens extend Boardwalk using only theme tokens; TV body text ≥18px at the
  720p design size and question text readable from 3m; avatar pop-in spring
  (~300ms) and carousel transition (~250ms) implemented per handoff.
- [ ] TV app remote surface — AC: the TV app requires zero remote interaction
  after launch (room auto-creates; everything else is phone-driven); the only
  remote-reachable control is an "About/version" item.
- [ ] Convex cloud project (development runs on an anonymous local backend at
  127.0.0.1, which real devices cannot reach) — AC: a Convex cloud free-tier
  deployment exists; both apps point at it; TV and phone on real hardware
  share room state. Requires the user — the project lands on their account.
- [ ] Real-device builds — AC: locally built APK installs and runs on the
  Philips Android TV; locally built APK runs on an Android phone; iOS
  controller build runs via Xcode on a physical iPhone and is uploaded to
  TestFlight.
- [ ] Play-test gate — AC: one full game night on real hardware: 4+ players,
  at least two full trivia games (one flat, one speed), at least one forced
  disconnect/rejoin — completed without restarting any app or the backend;
  every issue found is filed as a task before MVP is called done.
