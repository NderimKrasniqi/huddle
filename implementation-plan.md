# Implementation Plan

> **Reconciled 2026-08-07 against the existing implementation.**
> Huddle was built through a prior plan into Phase 5. This roadmap has been
> rebaselined against the actual repository. Completed tasks are checked with a
> one-line evidence note; unchecked tasks are the real remaining work.
>
> **Evidence baseline:** `pnpm typecheck` clean; `pnpm test` green — 57 files,
> 666 tests, 0 failures. Backend (`convex/convex/{rooms,players,games}.ts`),
> platform packages (`game-core`, `game-registry`, `packs`, `ui`), the Trivia
> module (`packages/games/trivia`), and both apps (`apps/tv`, `apps/controller`)
> are implemented and tested.
>
> **Primary remaining work:** the Voting/Test game (2.4) — the second game the
> approved scope requires to prove modularity — plus the follow-on acceptance
> matrix (5.4) and final review (5.6) that depend on it, and one stack
> correction (5.7). The monorepo apps are `apps/tv` + `apps/controller`
> (the "mobile" naming in the original draft mapped to the controller).

## Phase 1 — Create and Join a Live Room

**Outcome:** A locally built Android TV creates a room, native iOS/Android phones join it, and all clients see the same lobby. **— Complete.**

- [x] **1.1 — Establish the monorepo and local build baseline**
  - Done: pnpm workspaces (`apps/*`, `convex`, `packages/*`, `packages/games/*`), Expo SDK 57, RN 0.86, `react-native-tvos` on TV, Expo Router, Convex providers in both apps, root `typecheck`/`test` scripts, local iOS/Android/TV run scripts, native `ios/`+`android/` projects present.
  - Note: styling uses the Boardwalk design-token system, not NativeWind (see `tech-stack.md`). Controller RN fork alignment is tracked in 5.7.

- [x] **1.2 — Create authoritative room state**
  - Done: `convex/convex/rooms.ts` + `schema.ts` model rooms/players with room-code and membership indexes; 4-char codes; transactional creation; `rooms.test.ts` covers lookup and uniqueness.

- [x] **1.3 — Build the TV lobby**
  - Done: `apps/tv/app/index.tsx` + `src/tv-stage.tsx` show room code, QR join payload, and lobby; QR destination is native-app-only; invalid-room/restoration handled.

- [x] **1.4 — Build native phone joining and participant identity**
  - Done: `apps/controller/app/join/[code].tsx` join-by-code + deep link; display name and built-in avatar/color selection; Session Token issued and stored in SecureStore (`src/session-store.ts`); 10-player ceiling (`ROOM_PLAYER_CAP`); first joiner becomes host.
  - Note: QR is scanned by the phone OS camera, which opens the join deep link (no in-app camera dependency). Local persistence of the *last-used* name/avatar (AsyncStorage) is not implemented — optional per scope ("the app *may* remember"); tracked in 5.8.

- [x] **1.5 — Complete the reactive room lobby**
  - Done: live roster + host identity on TV and phones; empty room preserved while the TV holds; next joiner becomes host in a hostless room; covered by `players.test.ts` / `rooms.test.ts`.

## Phase 2 — Select and Run a Modular Game

**Outcome:** The host selects/configures a game from the phone, the TV mirrors the choice, and a game runs end-to-end through a generic runtime. **— Platform complete; the Voting game (2.4) is the main remaining MVP feature.**

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

- [ ] **3.7 — Host management controls: manual transfer and player removal** *(added by 5.4 — closes findings F1/F2; backend done, host-roster UI remains)*
  - The 5.4 acceptance matrix found two approved host powers (`project-scope.md`
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
  - **Remaining:** wire the controls into the Host's roster screen
    (`apps/controller/app/index.tsx`) — a design-informed change
    (`docs/design/design-handoff.md` §5 defines the roster and does not yet
    specify transfer/remove affordances), and RN screen code is not unit-tested
    per the stack. Until then the capability exists and is authorized/tested but
    is not reachable from the UI.
  - **Verify (met for the backend):** happy paths + every refusal in
    `players.test.ts`; a removed token no longer resolves via `session`; a
    transfer flips `host` on the roster; the controller maps each refusal.

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

**Outcome:** The complete MVP runs reliably on Android TV + iOS/Android phones and is checked against the approved scope. **— Mostly complete; 5.4/5.6 depend on the Voting game, plus one stack correction (5.7).**

- [x] **5.1 — Handle join and network failure UX**
  - Done: invalid/expired code, full room, and rejection states (`join-rejection.ts`, `game-rejection.ts`, `color-rejection.ts`); duplicate-submission guards; tested.

- [x] **5.2 — Harden the Android TV shared display**
  - Done: large-screen layout, safe-area, typography floors, and the two handoff animations landed in Phase 5 design-fidelity work; every flow is driven from phones with the TV as display only.
  - Note: the earlier "confirm NativeWind on Android TV" check is retired — styling is the Boardwalk token system.

- [x] **5.3 — Harden phone app lifecycle and deep links**
  - Done: foreground/background, lock/unlock, QR deep links, cold start, and reconnection credentials verified, including real-device verification (see git history).

- [ ] **5.4 — Run the multiplayer acceptance matrix across both games** *(matrix delivered; blocked on F1/F2 decisions)*
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
  - **Blocked:** the matrix surfaced two approved workflows with no
    implementation, so no check can pass for them — **F1 manual host transfer**
    and **F2 host-initiated player removal** (see `docs/acceptance-matrix.md`
    Findings). Both need a decision: implement, or amend the scope. **F3** (TV
    recovery modeled via player presence, not a TV heartbeat/pause) is a
    reconciliation note for 5.6, not a blocker. Manual mixed-hardware rows (🧪)
    remain per-release checks, last run in 5.3.

- [x] **5.5 — Finalize local build and verification commands**
  - Done: single-command root `typecheck`/`test`/`test:unit`/`test:integration`; per-app run scripts; commands reconciled into `tech-stack.md`.
  - Optional follow-up: add convenience root aliases (`test:backend`, per-target run scripts) if desired.

- [ ] **5.6 — Perform final scope/architecture review** *(remaining — last)*
  - Re-read `project-scope.md`, `tech-stack.md`, and this plan against the implemented behavior **including the Voting game**.
  - Confirm no accidental scope crept in and no unnecessary server/realtime/state/cloud-build/persistence infrastructure was introduced.
  - **Verify:** every MVP requirement maps to completed behavior and no blocking discrepancy remains.

- [x] **5.7 — Align the Controller to the `react-native-tvos` fork**
  - Done: `apps/controller/package.json` now uses `react-native: npm:react-native-tvos@~0.86.0-2`, matching the TV. `pnpm install` re-resolved the controller's whole tree onto the fork and deduped the redundant plain-RN dependency tree (lockfile −442/+27; `--frozen-lockfile` clean). Both apps now resolve one RN fork.
  - Verified: `pnpm typecheck` clean (incl. `apps/controller`); `pnpm test` green (702); `pnpm lint` clean. `expo prebuild --clean` regenerated the controller's iOS project and `pod install` resolved cleanly against the fork (`React-Core 0.86.0-2`; `require('react-native')` → `react-native-tvos@0.86.0-2`) — the dependency-conflict surface this task targets, at both the JS and native layers. A full `xcodebuild`/simulator launch was not run; the fork is the same drop-in the TV already compiles.
  - No `@react-native-tvos/config-tv` and no `EXPO_TV` on the controller, so it stays a phone build.

- [ ] **5.8 — (Optional) Remember last-used name and avatar locally**
  - Persist the last-used display name and avatar in AsyncStorage so returning players are prefilled; scope treats this as optional ("the app *may* remember").
  - **Verify:** a returning phone prefills its previous name/avatar; nothing sensitive is stored outside SecureStore.

## MVP Acceptance

The MVP is complete when Phase 2.4 (Voting game) ships, 5.4 passes across both
games, 5.7 is corrected, and 5.6 finds no blocking discrepancy against the
approved scope and stack.
