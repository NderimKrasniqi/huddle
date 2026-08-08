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
> **Remaining work (as of 2026-08-08):** every required task is complete. 5.6
> closed the MVP after finding and fixing two blocking issues (a private-state
> broadcast and the missing end-room control). What is left is optional or
> follow-up: **5.8** (remember last-used name/avatar) and **5.9** (keep the
> question pack out of the Controller bundle). The monorepo apps are `apps/tv` +
> `apps/controller` (the "mobile" naming in the original draft mapped to the
> controller).

## Phase 1 — Create and Join a Live Room

**Outcome:** A locally built Android TV creates a room, native iOS/Android phones join it, and all clients see the same lobby. **— Complete.**

- [x] **1.1 — Establish the monorepo and local build baseline**
  - Done: pnpm workspaces (`apps/*`, `convex`, `packages/*`, `packages/games/*`), Expo SDK 57, RN 0.86, `react-native-tvos` on TV, Expo Router, Convex providers in both apps, root `typecheck`/`test` scripts, local iOS/Android/TV run scripts, native `ios/`+`android/` projects present.
  - Note: styling uses the Boardwalk design-token system, not NativeWind (see `docs/tech-stack.md`). Controller RN fork alignment is tracked in 5.7.

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
    screen (`apps/controller/app/index.tsx`) as a **manage sheet** — the
    design decision, since `docs/design/design-handoff.md` §5 drew the roster
    but not the act of managing a player; §5 now specifies it. Every non-Host row gains a
    disclosure chevron and opens a centred Boardwalk confirm dialog offering
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

**Outcome:** The complete MVP runs reliably on Android TV + iOS/Android phones and is checked against the approved scope. **— Nearly complete; only 5.6 (final scope/architecture review) remains. The Voting game shipped, 5.4's F1/F2 gap was closed by task 3.7, and the 5.7 stack correction landed.**

- [x] **5.1 — Handle join and network failure UX**
  - Done: invalid/expired code, full room, and rejection states (`join-rejection.ts`, `game-rejection.ts`, `color-rejection.ts`); duplicate-submission guards; tested.

- [x] **5.2 — Harden the Android TV shared display**
  - Done: large-screen layout, safe-area, typography floors, and the two handoff animations landed in Phase 5 design-fidelity work; every flow is driven from phones with the TV as display only.
  - Note: the earlier "confirm NativeWind on Android TV" check is retired — styling is the Boardwalk token system.

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
  - **B2 — no "end the room" control**, though the scope lists it as a Host power. Added `rooms.endRoom` (Session-Token gated through the shared `host-control.ts`, cancels the game clock, deletes players then the room) and a confirm sheet on the Host's lobby. **Scope note:** it is offered in the lobby only, not mid-game — a Host who wants out of a *game* has "Back to lobby", and the room outlives games by design. `docs/project-scope.md:114` lists the power unqualified.
  - **Also closed, found by the follow-up security review:** the dealt questions carried `correctIndex` for every question and all future question text, so a client reading its own socket had the whole game — first at the opening payload, then (after an incomplete first fix) at every five-second reveal. The projection now withholds unplayed questions on *every* beat and releases an answer only for a question the room has been shown.
  - **Also closed, found by the follow-up code review:** the phones never actually returned to the Join Screen — `players.session` was a one-shot read, so nothing noticed a seat ending, and the end-room copy promised what did not happen. The seated screen now subscribes to its seat, which also covers `removePlayer` and room expiry.
  - **Verify:** `pnpm typecheck` clean (9 workspaces); `pnpm lint` clean; `pnpm test` green — **771 passed, 64 files**. Independent code review and security review both **PASS** on the final tree, each having re-verified the redaction against a real payload.
  - **Not verified on hardware:** that both phones reach the Join Screen after a Host ends the room, and that the TV opens a fresh room afterwards. Reviewed by reading only, per the stack's no-RN-render-tests rule.
  - Residual, recorded rather than fixed: **5.9** below (the pack ships in the Controller bundle, so a *modified* client can still reproduce the deal); `expireRoom` still does not cancel a pending game deadline, unlike `endRoom`; a removed player lands on the join form with no explanation.

- [x] **5.7 — Align the Controller to the `react-native-tvos` fork**
  - Done: `apps/controller/package.json` now uses `react-native: npm:react-native-tvos@~0.86.0-2`, matching the TV. `pnpm install` re-resolved the controller's whole tree onto the fork and deduped the redundant plain-RN dependency tree (lockfile −442/+27; `--frozen-lockfile` clean). Both apps now resolve one RN fork.
  - Verified: `pnpm typecheck` clean (incl. `apps/controller`); `pnpm test` green (702); `pnpm lint` clean. `expo prebuild --clean` regenerated the controller's iOS project and `pod install` resolved cleanly against the fork (`React-Core 0.86.0-2`; `require('react-native')` → `react-native-tvos@0.86.0-2`) — the dependency-conflict surface this task targets, at both the JS and native layers. A full `xcodebuild`/simulator launch was not run; the fork is the same drop-in the TV already compiles.
  - No `@react-native-tvos/config-tv` and no `EXPO_TV` on the controller, so it stays a phone build.

- [ ] **5.8 — (Optional) Remember last-used name and avatar locally**
  - Persist the last-used display name and avatar in AsyncStorage so returning players are prefilled; scope treats this as optional ("the app *may* remember").
  - **Verify:** a returning phone prefills its previous name/avatar; nothing sensitive is stored outside SecureStore.

- [ ] **5.9 — (Follow-up) Keep the question pack out of the Controller bundle**
  - Raised by 5.6's security review. The wire no longer carries unplayed questions or their answers (`redactStateFor`), but `@huddle/packs` is still reachable from the Controller's entry point — `apps/controller` → `@huddle/game-registry` → `@huddle/game-trivia` → `./questions` → `CURATED_PACK` — and `questionsFor` is deterministic, so a **modified** client can reproduce the exact deal locally and know every answer.
  - The redaction is what stops a passive read (the socket, a proxy, an honest client showing too much); this is what would stop a determined one.
  - The fix is structural rather than a projection: the client-side `GameModule` would have to stop carrying `createInitialState`, so the dealing code — and the pack with it — stays on the server. Deliberately not attempted inside 5.6.
  - **Verify:** a production Controller bundle contains no pack question text; the server still deals a game unchanged.

## MVP Acceptance

The MVP is complete when Phase 2.4 (Voting game) ships, 5.4 passes across both
games, 5.7 is corrected, and 5.6 finds no blocking discrepancy against the
approved scope and stack.
