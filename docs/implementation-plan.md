# Implementation Plan

> **Reconciled 2026-08-09 against the existing implementation.**
> Huddle was built through a prior plan into Phase 5. This roadmap has been
> rebaselined against the actual repository. Completed tasks are checked with a
> one-line evidence note; unchecked tasks are the real remaining work.
>
> **Evidence baseline:** `pnpm typecheck` clean; `pnpm test` green — 65 files,
> 768 tests, 0 failures. Backend (`convex/convex/{rooms,players,games}.ts`),
> platform packages (`game-core`, `game-registry`, `packs`, `ui`), the Trivia
> module (`packages/games/trivia`), and both apps (`apps/tv`, `apps/controller`)
> are implemented and tested.
>
> **Remaining work (as of 2026-08-09):** no required implementation task is
> open. 5.6 closed the MVP after finding and fixing two blocking issues (a
> private-state broadcast and the missing end-room control), 5.8 (the optional
> remember-me) shipped, 5.9 kept the question pack out of the Controller
> bundle, and 5.10 reconciled the approved Soft Minimal TV visuals and assets.
> The monorepo apps are `apps/tv` + `apps/controller` (the "mobile" naming in
> the original draft mapped to the controller).

## Phase 1 — Create and Join a Live Room

**Outcome:** A locally built Android TV creates a room, native iOS/Android phones join it, and all clients see the same lobby. **— Complete.**

- [x] **1.1 — Establish the monorepo and local build baseline**
  - Done: pnpm workspaces (`apps/*`, `convex`, `packages/*`, `packages/games/*`), Expo SDK 57, RN 0.86, `react-native-tvos` on TV, Expo Router, Convex providers in both apps, root `typecheck`/`test` scripts, local iOS/Android/TV run scripts, native `ios/`+`android/` projects present.
  - Note: styling uses the Soft Minimal design-token system, not NativeWind (see `docs/tech-stack.md`). Controller RN fork alignment is tracked in 5.7.

- [x] **1.2 — Create authoritative room state**
  - Done: `convex/convex/rooms.ts` + `schema.ts` model rooms/players with room-code and membership indexes; 4-char codes; transactional creation; `rooms.test.ts` covers lookup and uniqueness.

- [x] **1.3 — Build the TV lobby**
  - Done: `apps/tv/src/app/tv-screen.tsx` + `src/tv-stage.tsx` show room code, QR join payload, and lobby; QR destination is native-app-only; invalid-room/restoration handled.

- [x] **1.4 — Build native phone joining and participant identity**
  - Done: `apps/controller/app/join/[code].tsx` join-by-code + deep link; display name and built-in avatar/color selection; Session Token issued and stored in SecureStore (`src/session-store.ts`); 10-player ceiling (`ROOM_PLAYER_CAP`); first joiner becomes host.
  - Note: QR is scanned by the phone OS camera, which opens the join deep link (no in-app camera dependency). Local persistence of the *last-used* name/avatar (AsyncStorage) shipped in 5.8.

- [x] **1.5 — Complete the reactive room lobby**
  - Done: live roster + host identity on TV and phones; empty room preserved while the TV holds; next joiner becomes host in a hostless room; covered by `players.test.ts` / `rooms.test.ts`.

## Phase 2 — Select and Run a Modular Game

**Outcome:** The host selects/configures a game from the phone, the TV mirrors the choice, and a game runs end-to-end through a generic runtime. **— Complete; both the Trivia and Voting modules ship on the generic runtime.**

- [x] **2.1 — Define the platform game contract**
  - Done: `packages/game-core/src/game-module.ts` + `game-settings.ts` + `room-phase.ts` define metadata, min/max, config, lifecycle/pause, commands, public vs participant-private state, late-join and continue-after-leave; kept independent of Trivia.

- [x] **2.2 — Build the game catalog and host configuration flow**
  - Done: `packages/game-registry` (`registry.ts`, `browsing.ts`, `carousel.ts`) + host picker; TV mirrors selection/config; min/max enforced before start; config locked on start; non-host start rejected (tested).

- [x] **2.3 — Implement the generic game-session lifecycle**
  - Done: `convex/convex/games.ts` runs room → configuring → active/paused → finished → room; host-authorized start/pause/resume/end/replay/end-room; ending discards game state but preserves room/participants/host; `games.test.ts` covers no-leak and stable room identity.

- [x] **2.4 — Build the Voting/Test game as the second module**
  - Done: `packages/games/voting` ("Hot Takes") is a `GameModule` built only against `@huddle/game-core`; registered by one entry in `GAME_REGISTRY` + `GAME_LOGIC_REGISTRY`, with **no** edits to `convex/convex/{rooms,players,games}.ts`. Vote privacy is structural — the state stores an anonymous per-option tally plus a set of who-has-voted, never attribution — so no payload can name a voter's choice even though the hub returns state whole. Both beats run on the room's own clock; away-aware early reveal mirrors Trivia. 36 new Vitest tests; typecheck/lint/tests green (702). Independent code-review and security-review both PASS.

- [x] **2.5 — Enforce authorization and privacy boundaries**
  - Done: public Convex functions validate input/return shapes; participant actions require the Session Token; host commands require host authority; private state is projected only to the entitled participant; `players.test.ts`/`games.test.ts` prove unauthorized commands and private-state reads are rejected.

## Phase 3 — Survive Disconnects and Ownership Changes

**Outcome:** Phone, host, and TV interruptions recover predictably without corrupting state. **— Complete.**

- [x] **3.1 — Add presence and background grace periods**
  - Done: `players.ts` heartbeat + `lastSeenAt` + `away`; scheduled `markAway`; grace period so brief backgrounding is not an immediate disconnect; fake-time tested.

- [x] **3.2 — Recover ordinary players**
  - Done: disconnected identity/state preserved for the recovery window; reconnect with the valid SecureStore token restores the same participant; host may wait or continue (a game never waits for an away player). Host-initiated *removal* (which invalidates the old participant) landed later as `removePlayer` — see **3.7**, since it did not exist when this task was first marked done.

- [x] **3.3 — Handle host transfer and loss**
  - Done: automatic loss handling — `handOverRoom` promotes the longest-connected eligible player on unrecovered disconnect; hostless empty-room behavior preserved. *Manual* transfer landed later as `transferHost` — see **3.7**, since it did not exist when this task was first marked done.

- [x] **3.4 — Recover the TV or close the room**
  - Done: TV-disconnect pause; room/game state preserved for a recovery window; restore on return; `expireRoom` cleans up and frees the code when the window lapses.

- [x] **3.5 — Enforce game rules during membership changes**
  - Done: late-join policy and below-minimum handling in the runtime; Trivia away-players-in-game behavior shipped (see git history); covered by tests.

- [x] **3.6 — Run lifecycle regression tests with fake time**
  - Done: player/host/TV timeouts, scheduled transitions, cleanup, and reconnect races covered deterministically under fake timers in the convex suite.

- [x] **3.7 — Host management controls: manual transfer and player removal** *(added by 5.4 — closes findings F1/F2)*
  - The 5.4 acceptance matrix found two approved host powers (`docs/project-scope.md`
    Host; Phone Backgrounding and Disconnection) with no implementation: manual
    host transfer and host-initiated player removal. The 3.2/3.3 notes claimed
    them; only automatic presence-driven `handOverRoom` existed.
  - **Done (backend + client plumbing, fully tested):** host-authorized
    `transferHost` and `removePlayer` mutations (`convex/convex/players.ts`).
    Transfer hands the room to a chosen **connected** player (an away target is
    refused, `targetAway`, mirroring the automatic handover's connected-successor
    rule); removal deletes the target's seat, invalidating their Session Token
    (`session` then returns null; they may rejoin as a fresh seat). Both share a
    Session-Token host gate and refuse a non-host caller (`notHost`), a stale
    token (`notInRoom`), a target outside the room (`targetNotInRoom`), and the
    host's own seat (`targetIsSelf`). Removal is allowed mid-game — the running
    beat still resolves on the room's server clock. New `HostControlRejection`
    type in game-core; controller mapper `host-control-rejection.ts` turns each
    refusal into a host-readable line. 13 new convex tests + 5 controller tests;
    `room-phase.ts` and the 3.2/3.3 notes corrected. **Independent security
    review: PASS** (token-first authorization complete, cross-room/self-target
    guards hold, credential invalidation total, no mid-game deadlock).
  - **Done (host-roster UI):** both controls are wired into the Host's roster
    screen (`apps/controller/src/app/controller-screen.tsx`) as a **manage sheet** — the
    design decision, since `docs/design/legacy/boardwalk-handoff.md` §5 drew the roster
    but not the act of managing a player; §5 now specifies it. Every non-Host row gains a
    disclosure chevron and opens a centred Soft Minimal confirm dialog offering
    "Make host" (cobalt) and "Remove" (punch); the Host's own row offers
    nothing (`targetIsSelf`), transfer is disabled for an away target
    (`targetAway`), and each refusal is surfaced through
    `hostControlFailureMessage`. Which controls a row offers and their live
    state is the pure `apps/controller/src/host-controls.ts` (`rosterRowControls`,
    `rosterRowIsManageable`) with 7 Vitest tests, matching the `host-roster.ts`
    pattern; the RN screen itself is not unit-tested per the stack.
  - **Verify:** backend — happy paths + every refusal in `players.test.ts`; a
    removed token no longer resolves via `session`; a transfer flips `host` on
    the roster; the controller maps each refusal. UI logic — `host-controls.test.ts`
    (own row offers nothing; present row offers both live; away row dims transfer
    and keeps remove). Typecheck and lint clean across the workspace.
  - **On-device pass (iPhone 17 simulator, against the cloud dev deployment):**
    joined as host → own row shows the HOST pill and *no* chevron; a second
    (CLI-seeded) player appears as a non-Host row with the online dot and
    disclosure chevron, footer flips to "2 players in — you can start anytime";
    that player going away drew the away treatment (dimmed avatar, muted name,
    muted dot) with the chevron kept; the row press opened the manage sheet over
    a dimmed room; the sheet showed **transfer dimmed with the away hint** and
    **remove live**; **Remove ran end-to-end** — `removePlayer` fired, the sheet
    closed, the row dropped, and the footer returned to "1 player in". The
    enabled-transfer tap was not exercised on device (the seeded player was away
    by then), but it is the identical `run()` path as remove and `transferHost`
    itself was verified live against the same deployment. Remaining manual
    mixed-hardware rows stay per-release checks (see `docs/acceptance-matrix.md`).

## Phase 4 — Build the Full Trivia Game

**Outcome:** A complete multiplayer Trivia game exercises private inputs, shared TV state, timers, rounds, scoring, and recovery. **— Complete.**

- [x] **4.1 — Define Trivia metadata, rules, and built-in content**
  - Done: curated question packs in `packages/packs`; player range, round/question counts, answer duration, scoring, and late-join/continue exposed through the contract.

- [x] **4.2 — Implement the authoritative Trivia state machine**
  - Done: round/question/answer/reveal/result states; one-answer-per-player validation; authoritative deadlines with Convex scheduled functions; server-side scoring (incl. speed mode); `games.test.ts` covers valid/invalid answers, deadlines, and scoring.

- [x] **4.3 — Build the phone Trivia experience**
  - Done: participant-private answer controls + submission/locked states; reconnect/paused handling; logic tested in `apps/controller/src`.

- [x] **4.4 — Build the TV Trivia experience**
  - Done: shared question, locally-rendered countdown from the authoritative deadline, round progress, reveal/results, scoreboard, podium; no local authoritative decisions.

- [x] **4.5 — Integrate Trivia with platform interruption rules**
  - Done: late join, player disconnect, host disconnect/transfer, below-minimum, and TV recovery exercised against Trivia.

- [x] **4.6 — Finish, replay, and return to room**
  - Done: final scoring/podium; replay via a clean session; return to the existing room; back-to-back games do not leak prior state (tested).

## Phase 5 — Harden the Local MVP

**Outcome:** The complete MVP runs reliably on Android TV + iOS/Android phones and is checked against the approved scope. **— Complete; 5.6, the 5.7 stack correction, the 5.9 bundle boundary, and the 5.10 TV visual reconciliation are all done.**

- [x] **5.1 — Handle join and network failure UX**
  - Done: invalid/expired code, full room, and rejection states (`join-rejection.ts`, `game-rejection.ts`, `color-rejection.ts`); duplicate-submission guards; tested.

- [x] **5.2 — Harden the Android TV shared display**
  - Done: large-screen layout, safe-area, typography floors, and the two handoff animations landed in Phase 5 design-fidelity work; every flow is driven from phones with the TV as display only.
  - Note: the earlier "confirm NativeWind on Android TV" check is retired — styling is the Soft Minimal token system.

- [x] **5.3 — Harden phone app lifecycle and deep links**
  - Done: foreground/background, lock/unlock, QR deep links, cold start, and reconnection credentials verified, including real-device verification (see git history).

- [x] **5.4 — Run the multiplayer acceptance matrix across both games** *(matrix delivered; F1/F2 implemented by 3.7)*
  - Exercise up to 10 members where the selected game supports it, across **both** Trivia and Voting.
  - Test mixed iOS/Android controllers with Android TV, host participation, host transfer, player removal/rejoin, late join, TV recovery, and back-to-back games (including switching between the two games).
  - **Verify:** every approved MVP workflow has at least one passing automated or documented manual check, with the second game included.
  - Done so far: `docs/acceptance-matrix.md` maps every approved MVP workflow to
    its evidence with Trivia **and** Voting columns. The "second game included"
    gap at the hub level is now closed by `convex/convex/voting-lifecycle.test.ts`
    (19 new tests driving the game-agnostic hub with `gameId: 'voting'` —
    start/range/settings, event dispatch, anonymous-tally privacy, away-in-game,
    both server-clocked beats, end/replay, and Trivia↔Voting switching). Suite:
    62 files / 721 tests green.
  - **Unblocked:** the two approved workflows the matrix surfaced with no
    implementation — **F1 manual host transfer** and **F2 host-initiated player
    removal** — were implemented rather than dropped, in task **3.7**: the
    `transferHost`/`removePlayer` mutations (tested, security-reviewed) and the
    Host Roster's manage sheet (`host-controls.ts` tests). Both matrix rows now
    have passing automated coverage for their logic; the sheet's on-device render
    joins the manual mixed-hardware rows (🧪) as a per-release check. **F3** (TV
    recovery modeled via player presence, not a TV heartbeat/pause) is a
    reconciliation note for 5.6, not a blocker. Manual rows remain per-release
    checks, last run in 5.3.

- [x] **5.5 — Finalize local build and verification commands**
  - Done: single-command root `typecheck`/`test`/`test:unit`/`test:integration`; per-app run scripts; commands reconciled into `docs/tech-stack.md`.
  - Optional follow-up: add convenience root aliases (`test:backend`, per-target run scripts) if desired.

- [x] **5.6 — Perform final scope/architecture review**
  - Done: the review ran as an independent reviewer and returned **CHANGES REQUIRED** on two findings, both since implemented and re-reviewed.
  - **Architecture discipline passed unchanged:** no separate API server, WebSocket gateway, Postgres/Redis, EAS, Docker/K8s or auth provider; no client-side duplication of Convex state; both apps on the `react-native-tvos` fork; the hub still depends on no game module.
  - **B1 — private player state was broadcast.** `games.running` returned the game state whole, so every phone *and the TV* received each player's chosen option before the reveal — against the scope's "private player state stays private" and "the TV never receives player-private game information". Fixed with a module-owned projection: optional `redactStateFor(state, viewer)` on `GameLogic`, implemented by trivia, applied by `running`, which resolves the viewer from the Session Token server-side (`viewerIn`) and never from client-supplied identity. It is a read-only view: `reduce` always runs on the stored row, so a hidden answer still scores in full.
  - **B2 — no "end the room" control**, though the scope listed it as a Host power. Added `rooms.endRoom` (Session-Token gated through the shared `hostControl.ts`, cancels the game clock, deletes players then the room) and a confirm sheet on the Host's lobby. **Superseded 2026-08-09:** the Soft Minimal screen replacement removed `endRoom` entirely and replaced it with `players.leaveRoom`, which every player has. A room now ends when its *last player leaves* rather than when one player closes it on the rest, and the scope was amended to match. Left here as the record of what 5.6 shipped, not as a description of the code.
  - **Also closed, found by the follow-up security review:** the dealt questions carried `correctIndex` for every question and all future question text, so a client reading its own socket had the whole game — first at the opening payload, then (after an incomplete first fix) at every five-second reveal. The projection now withholds unplayed questions on *every* beat and releases an answer only for a question the room has been shown.
  - **Also closed, found by the follow-up code review:** the phones never actually returned to the Join Screen — `players.session` was a one-shot read, so nothing noticed a seat ending, and the end-room copy promised what did not happen. The seated screen now subscribes to its seat, which also covers `removePlayer` and room expiry.
  - **Verify:** `pnpm typecheck` clean (9 workspaces); `pnpm lint` clean; `pnpm test` green — **771 passed, 64 files**. Independent code review and security review both **PASS** on the final tree, each having re-verified the redaction against a real payload.
  - **Not verified on hardware:** that both phones reach the Join Screen after a Host ends the room, and that the TV opens a fresh room afterwards. Reviewed by reading only, per the stack's no-RN-render-tests rule.
  - Residuals recorded here: **5.9** below (the pack ships in the Controller bundle, so a *modified* client can still reproduce the deal) was closed by the follow-up bundle-boundary task. The three smaller ones have since been closed on branch `fix/5.6-residuals`: `expireRoom` now cancels a pending game deadline exactly as `endRoom` does; a player who loses a seat lands on the join form with a line saying why — "The host removed you from the room." when the room is still standing, "This room has closed." when it is not (told apart by the roster on the same Convex snapshot, `apps/controller/src/seat-loss.ts`); and the two host-confirm sheets now share one `ConfirmSheet` shell (surface, scrim, Cancel) rather than duplicating it.

- [x] **5.7 — Align the Controller to the `react-native-tvos` fork**
  - Done: `apps/controller/package.json` now uses `react-native: npm:react-native-tvos@~0.86.0-2`, matching the TV. `pnpm install` re-resolved the controller's whole tree onto the fork and deduped the redundant plain-RN dependency tree (lockfile −442/+27; `--frozen-lockfile` clean). Both apps now resolve one RN fork.
  - Verified: `pnpm typecheck` clean (incl. `apps/controller`); `pnpm test` green (702); `pnpm lint` clean. `expo prebuild --clean` regenerated the controller's iOS project and `pod install` resolved cleanly against the fork (`React-Core 0.86.0-2`; `require('react-native')` → `react-native-tvos@0.86.0-2`) — the dependency-conflict surface this task targets, at both the JS and native layers. A full `xcodebuild`/simulator launch was not run; the fork is the same drop-in the TV already compiles.
  - No `@react-native-tvos/config-tv` and no `EXPO_TV` on the controller, so it stays a phone build.

- [x] **5.8 — (Optional) Remember last-used name and avatar locally**
  - Persist the last-used display name and avatar in AsyncStorage so returning players are prefilled; scope treats this as optional ("the app *may* remember").
  - Done: a pure, unit-tested seam mirroring `session.ts` — `apps/controller/src/identity.ts` (parse/recall/remember, injectable store) with `identity-store.ts` as the `AsyncStorage` platform half. The name is remembered on a successful `joinRoom` and prefills the join field (seed-only; a `touched` latch never overwrites what the player is typing). The color is remembered on a successful `claimColor` and re-taken on the seated screen the first time a player sits down colorless — gated on the roster having landed, only if the swatch is still free, and silent on refusal. Nothing sensitive leaves SecureStore: only the nickname and a color *name* go to `AsyncStorage`; the Session Token stays in the keystore (`session-store.ts`). 16 new Vitest tests (787 total).
  - **Verify:** a returning phone prefills its previous name/avatar; nothing sensitive is stored outside SecureStore. Typecheck/lint/tests green; not yet exercised on hardware.

- [x] **5.9 — (Follow-up) Keep the question pack out of the Controller bundle**
  - Raised by 5.6's security review. The wire no longer carries unplayed questions or their answers (`redactStateFor`), but `@huddle/packs` is still reachable from the Controller's entry point — `apps/controller` → `@huddle/game-registry` → `@huddle/game-trivia` → `./questions` → `CURATED_PACK` — and `questionsFor` is deterministic, so a **modified** client can reproduce the exact deal locally and know every answer.
  - The redaction is what stops a passive read (the socket, a proxy, an honest client showing too much); this is what would stop a determined one.
  - The fix is structural rather than a projection: the client-side `GameModule` would have to stop carrying `createInitialState`, so the dealing code — and the pack with it — stays on the server. Deliberately not attempted inside 5.6.
  - **Verify:** a production Controller bundle contains no pack question text; the server still deals a game unchanged.
  - **Done** (branch `fix/5.9-pack-out-of-client-bundle`). The fix turned out larger than "stop carrying `createInitialState`": the client's *screens* also pulled `./logic` (and the pack behind it) through pure value helpers (`revealBeat`, `answersIn`, `playersCounted`, `QUESTION_SECONDS`), and the trivia *barrel* re-exported `triviaGameLogic` as a value. Changes: `GameModule` no longer `extends GameLogic` (game-core) — a client type with metadata/settingsSchema/screens and no rules; the pack-free selectors moved to `trivia/src/state.ts` so the screens import them without `./logic`; `settings.ts` takes category names from a new client-safe `@huddle/packs/categories` (`curated-categories.ts`, drift-guarded by test) instead of `./questions`; the trivia barrel re-exports the module + types only (`export type { … }`, not `export { type … }` — the latter keeps a runtime edge). Guards: an eslint `no-restricted-imports` ban on `@huddle/packs` in client files, and `client-seam.test.ts`. **Verified** by bundling the client registry entry with esbuild — `huddle-classics.json`, `curated-pack.ts`, `questions.ts`, `logic.ts` are absent from the client module graph and no question text is in the output; the server's `games.test.ts` deals unchanged. Independent security review **PASS**.

- [x] **5.10 — Reconcile Soft Minimal TV visuals and shipped assets**
  - Done: `huddle-tv-background-01.png` is the full-viewport TV canvas; only the 1280×720 content layer receives `tvSafeStageScale`, with `colors.screen` retained as the loading fallback.
  - Done: Android TV uses the supplied 1024px launcher icon and 640×360 banner through `@react-native-tvos/config-tv` (`androidTVIcon`, `androidTVBanner`, `androidTVRequired: true`); regenerated native resources contain the required Leanback feature and launcher metadata.
  - Done: Room geometry, 5×2 seating, warm surfaces, neutral caption, gold Host crown, blue AWAY chip, footer player-count icon, structured invitation copy, and Host/greeting/status accessibility precedence match the approved 1672×941 board. The Room arithmetic and caption/status tests cover the landmarks.
  - Done: all ten stable avatar IDs are regenerated from `HUDDLE ASSETS/avatars/squares/` by a validate-first painted-disc crop pipeline; every runtime asset is 640×640 RGBA and the source/runtime ID sets must match exactly.
  - **Verify:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm validate:packs`, avatar `--check`, TV prebuild/resource inspection, and Expo TV export. Physical Philips Android TV checks (launcher, overscan, QR scan, sofa-distance legibility) remain a manual release check.

## MVP Acceptance

The MVP is complete when Phase 2.4 (Voting game) ships, 5.4 passes across both
games, 5.7 is corrected, 5.6 finds no blocking discrepancy against the
approved scope and stack, and 5.10 reconciles the shipped TV visuals/assets
against the approved Soft Minimal board.

---

# Feature 6 — F-006 Platform Reliability and Maintainability

The Phase 1–5 sections above are a frozen historical baseline. Repository
inspection reopened TV recovery and fail-closed runtime work that had been
claimed complete, so Feature 6 is the active, resumable implementation stream.
It preserves Expo, Convex, the game registry, Soft Minimal assets/palette, and
the existing public room/game contracts except for the intentional TV APIs and
`createRoom` → `openRoom` replacement.

**Current feature:** —
**Current phase:** —
**Current task:** —
**Last completed task:** 6.6.1 Run complete automated, export, prebuild, and device verification
**Blockers:** None

## Phase 6.1 — Project workflow and truth

- [x] **6.1.1 — Replace/adapt project workflow skills**
  - Vendor the five supplied skills under `.agents/skills/`, normalize their
    Codex metadata, adapt helpers to resolve `docs/` from a repository root,
    remove obsolete Claude/Convex skill copies, and add the workflow check.
  - **Traceability:** C-006.5.
  - **Depends on:** None

- [x] **6.1.2 — Create architecture and resumable Feature 6 project truth**
  - Add `docs/architecture.md`, reconcile scope/stack/acceptance claims, and
    record F-006/J-006/C-006.1–C-006.5/BR-006–BR-009 with frozen Phases 1–5.
  - **Traceability:** F-006, J-006, C-006.1, C-006.2, C-006.3, C-006.4,
    C-006.5, BR-006, BR-007, BR-008, BR-009.
  - **Depends on:** 6.1.1

## Phase 6.2 — Fail-closed game runtime

- [x] **6.2.1 — Add runtime versions, decoders, required projection, and client/server seams**
  - Extend `GameLogic`, add strict Trivia/Voting Zod 4 decoders behind
    server-only logic entries, make Voting’s client entry safe, and add the
    running response union plus remainder-aware TV props.
  - **Traceability:** C-006.3, BR-007.
  - **Depends on:** 6.1.2

- [x] **6.2.2 — Make Convex runtime operations and query projections fail closed**
  - Validate state, overwritten events, reducer output, deadlines, and
    redaction; return sanitized unavailable projections and inert malformed
    events with category-only logs.
  - **Traceability:** C-006.3, BR-007.
  - **Depends on:** 6.2.1

- [x] **6.2.3 — Make all game beats server-authoritative and TV countdowns remainder-aware**
  - Move Trivia reveal timing to the server, remove the controller timer hook,
    and initialize TV countdowns from the authoritative remainder.
  - **Traceability:** C-006.2, BR-008.
  - **Depends on:** 6.2.2

## Phase 6.3 — Durable TV session and recovery

- [x] **6.3.1 — Add durable TV credential, idempotent room opening, and creation limiting**
  - Add Expo Crypto/SecureStore, persist the TV token before mutation, add
    `tvSessions`, transactional `openRoom`, and the global new-token rate limit.
  - **Traceability:** J-006, C-006.1, BR-006.
  - **Depends on:** 6.2.1

- [x] **6.3.2 — Add TV heartbeat, pause/resume/expiry, and paused/unavailable UI**
  - Add 3-second heartbeat, 13-second away transition, exact pause remainder,
    ten-minute expiry, inert-away gameplay, and controller/TV paused and
    unavailable states.
  - **Traceability:** J-006, C-006.2, BR-006, BR-008.
  - **Depends on:** 6.3.1, 6.2.3

- [x] **6.3.3 — Purge legacy development rooms and tighten the final schema**
  - Deploy optional compatibility fields, run a development-only internal
    cleanup through `npx convex run`, verify zero legacy rows, then require
    final fields and remove the cleanup mutation.
  - **Traceability:** BR-009.
  - **Depends on:** 6.3.2

## Phase 6.4 — Maintainable module boundaries

- [x] **6.4.1 — Extract cohesive Convex helpers without changing public behavior**
  - Consolidate authorization, lifecycle, presence, clock, and runtime helpers
    under `convex/convex/lib/` while preserving generated public paths.
  - **Traceability:** C-006.4.
  - **Depends on:** 6.3.3

- [x] **6.4.2 — Extract Controller features and thin its routes**
  - Move join, room, picker, and game-session ownership into feature/platform
    folders with route adapters that only mount the coordinator.
  - **Traceability:** C-006.4.
  - **Depends on:** 6.4.1

- [x] **6.4.3 — Extract TV features and thin its route**
  - Move room, carousel, game-session, and room-session platform ownership into
    the TV feature-first folders without changing visuals or protocol behavior.
  - **Traceability:** C-006.4.
  - **Depends on:** 6.4.2

## Phase 6.5 — Soft Minimal and documentation reconciliation

- [x] **6.5.1 — Complete Soft Minimal and legacy-tooling cleanup**
  - Rename the legacy ESLint rule namespace to `softMinimal`, move the
    superseded handoff to `docs/design/legacy/`, and add a guard against stale
    historical design-system text in active source.
  - **Traceability:** C-006.4, C-006.5.
  - **Depends on:** 6.4.3

- [x] **6.5.2 — Reconcile documentation and acceptance evidence**
  - Update AGENTS, scope, architecture, acceptance matrix, asset README, and
    this plan with the adopted runtime/TV recovery semantics and evidence.
  - **Traceability:** C-006.5, J-006.
  - **Depends on:** 6.5.1

## Phase 6.6 — Verification and release evidence

- [x] **6.6.1 — Run complete automated, export, prebuild, and device verification**
  - Run workflow/task-state checks, typecheck, lint, all tests, pack/avatar
    validation, Expo export/prebuild, Android Leanback resource checks, and
    manual 1920×1080/Philips Android TV recovery verification.
  - Evidence so far: workflow validator/task-state tests PASS; typecheck and
    lint PASS; full suite PASS (69 files, 782 tests); `pnpm validate:packs`
    PASS; avatar `--check` PASS for all ten IDs; Android TV prebuild generated
    Leanback `required=true`, `@drawable/tv_icon`, and `@drawable/tv_banner`;
    Expo Android export PASS. Physical Philips verification remains a release
    checklist because this environment has no connected TV.
  - **Traceability:** F-006, J-006, BR-006, BR-007, BR-008, BR-009.
  - **Depends on:** 6.5.2
