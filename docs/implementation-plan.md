# Implementation Plan

> **Reconciled 2026-08-12 against the existing implementation and design
> inventory.** Huddle was built through a prior plan into Phase 5, then hardened
> through Features 6 and 7. All numbered implementation tasks below are complete;
> completed entries retain their closeout evidence, while the unnumbered backlog
> at the end records real follow-up work without pretending it already shipped.
>
> **Current evidence:** `pnpm typecheck`, `pnpm lint`, and
> `pnpm validate:workflow` clean; the complete Vitest suite is green — 74
> files, 868 tests — and the rendered Controller/TV suites are green. Backend
> (`convex/convex/{rooms,players,games}.ts`), platform packages (`game-core`,
> `game-registry`, owner-local Trivia content, `ui`), the Trivia
> module (`packages/games/trivia`), and both apps (`apps/tv`, `apps/controller`)
> are implemented and tested.
>
> **Dependency evidence:** `pnpm verify:dependency-security` exercises the
> committed `image-size@1.2.1` patch and pinned transitive remediations. The
> npm advisory endpoint was unavailable in this sandbox when `pnpm audit:prod`
> was attempted; the two intentionally excluded CVEs remain documented in
> `docs/dependency-security.md`.
>
> **2026-08-10 audit resolution:** Product direction resolved F4–F6. A
> TV-created room now survives an empty roster until TV-session expiry; every
> confirmed in-game player disconnect pauses the exact server clock for the
> current Host's Wait/Continue choice; and player ranges gate start only, so
> Continue is valid below the declared minimum. Regression coverage spans
> `games.test.ts`, `players.test.ts`, `tv-recovery.test.ts`, and both client
> projections. `image-size` still has no upstream release marked patched for
> its two advisories, so the local patch and narrow audit exclusions remain.

## Phase 1 — Create and Join a Live Room

**Outcome:** A locally built Android TV creates a room, native iOS/Android phones join it, and all clients see the same lobby. **— Complete.**

- [x] **1.1 — Establish the monorepo and local build baseline**
  - Done: pnpm workspaces (`apps/*`, `convex`, `packages/*`, `packages/games/*`), Expo SDK 57, RN 0.86, `react-native-tvos` on TV, Expo Router, Convex providers in both apps, root `typecheck`/`test` scripts, local iOS/Android/TV run scripts, native `ios/`+`android/` projects present.
  - Note: styling uses the Soft Minimal design-token system, not NativeWind (see `docs/tech-stack.md`). Controller RN fork alignment is tracked in 5.7.

- [x] **1.2 — Create authoritative room state**
  - Done: `convex/convex/rooms.ts` + `schema.ts` model rooms/players with room-code and membership indexes; 4-char codes; transactional creation; `rooms.test.ts` covers lookup and uniqueness.

- [x] **1.3 — Build the TV lobby**
  - Done: `apps/tv/src/features/room/` + `src/ui/tv-stage.tsx` show room code, QR join payload, and lobby; QR destination is native-app-only; invalid-room/restoration handled.

- [x] **1.4 — Build native phone joining and participant identity**
  - Done: the thin `apps/controller/app/join/[code].tsx` route feeds the Controller screen and `src/features/join/`; display name and built-in avatar selection; Session Token issued and stored through `src/platform/session/`; 10-player ceiling (`ROOM_PLAYER_CAP`); first joiner becomes host.
  - Note: QR is scanned by the phone OS camera, which opens the join deep link (no in-app camera dependency). Local persistence of the *last-used* name/avatar (AsyncStorage) shipped in 5.8.

- [x] **1.5 — Complete the reactive room lobby**
  - Done: live roster + host identity on TV and phones; empty room preserved while the TV holds; next joiner becomes host in a hostless room; covered by `players.test.ts` / `rooms.test.ts`.

## Phase 2 — Select and Run a Modular Game

**Outcome:** The host selects/configures a game from the phone, the TV mirrors the choice, and a game runs end-to-end through a generic runtime. **— Complete; both the Trivia and Voting modules ship on the generic runtime.**

- [x] **2.1 — Define the platform game contract**
  - Done: `packages/game-core/src/game-module.ts` + `game-settings.ts` + `room-phase.ts` define metadata, min/max, config, lifecycle/pause, commands, public vs participant-private state, late-join and continue-after-leave; kept independent of Trivia.

- [x] **2.2 — Build the game catalog and host configuration flow**
  - Done: `packages/game-registry` (`registry.ts`, `browsing.ts`, `carousel.ts`) + host picker; TV mirrors browsing and the explicit shared Game Setup draft; min/max enforced before start; config locked on start; non-host start rejected (tested).

- [x] **2.3 — Implement the generic game-session lifecycle**
  - Done: `convex/convex/games.ts` runs room → configuring → active/paused → finished → room; host-authorized start/pause/resume/end/replay/end-room; ending discards game state but preserves room/participants/host; `games.test.ts` covers no-leak and stable room identity.

- [x] **2.4 — Build the Voting/Test game as the second module**
  - Done: `packages/games/voting` ("Hot Takes") is a `GameModule` built only against `@huddle/game-core`; registered by one matching entry in the client `GAME_REGISTRY` and server `GAME_LOGIC_REGISTRY`, with **no** edits to `convex/convex/{rooms,players,games}.ts`. Vote privacy is structural — the state stores an anonymous per-option tally plus a set of who-has-voted, never attribution — so no payload can name a voter's choice even though the hub returns state whole. Both beats run on the room's own clock; away-aware early reveal mirrors Trivia. 36 new Vitest tests; typecheck/lint/tests green (702). Independent code-review and security-review both PASS.

- [x] **2.5 — Enforce authorization and privacy boundaries**
  - Done: public Convex functions validate input/return shapes; participant actions require the Session Token; host commands require host authority; private state is projected only to the entitled participant; `players.test.ts`/`games.test.ts` prove unauthorized commands and private-state reads are rejected.

## Phase 3 — Survive Disconnects and Ownership Changes

**Outcome:** Phone, host, and TV interruptions recover predictably without corrupting state. **— Complete.**

- [x] **3.1 — Add presence and background grace periods**
  - Done: `players.ts` heartbeat + `lastSeenAt` + `away`; scheduled `markAway`; grace period so brief backgrounding is not an immediate disconnect; fake-time tested.

- [x] **3.2 — Recover ordinary players**
  - Done: confirmed in-game silence cancels the server deadline and preserves its exact remainder; the Host may wait (automatic resume when all seats return) or continue without away seats, including below the starting minimum. Reconnect with the valid SecureStore token restores the same participant. Host-initiated *removal* (which invalidates the old participant) landed later as `removePlayer` — see **3.7**.

- [x] **3.3 — Handle host transfer and loss**
  - Done: on confirmed Host disconnect, `handOverRoom` promotes the longest-connected eligible player before publishing the player-held pause, so the successor receives the same Wait/Continue choice. The first returning seat repairs an all-away room's Host pointer. *Manual* transfer is `transferHost` — see **3.7**.

- [x] **3.4 — Recover the TV or close the room**
  - Done: TV-disconnect pause; room/game state preserved for a recovery window; restore on return; `expireTvRoom` cleans up and frees the code when the TV window lapses.

- [x] **3.5 — Enforce game rules during membership changes**
  - Done: player ranges gate start only; active games may continue below minimum after the Host's recovery choice. Late-join and away-player reducer behavior remain module-owned and are covered across Trivia/Voting.

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
    screen (`apps/controller/src/features/room/seated-screen.tsx`) as a **manage sheet** — the
    design decision captured in `docs/design/soft-minimal-handoff.md`. Every non-Host row gains a
    disclosure chevron and opens a centred Soft Minimal confirm dialog offering
    "Make host" and "Remove"; the Host's own row offers
    nothing (`targetIsSelf`), transfer is disabled for an away target
    (`targetAway`), and each refusal is surfaced through
    `hostControlFailureMessage`. Which controls a row offers and their live
    state is the pure `apps/controller/src/features/room/host-controls.ts` (`rosterRowControls`,
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
  - Done: curated question packs in `packages/games/trivia/packs`; player range, round/question counts, answer duration, scoring, and late-join/continue exposed through the contract.

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
  - Done: invalid/expired code, full room, and rejection states (`join-rejection.ts`, `game-rejection.ts`, `host-control-rejection.ts`); duplicate-submission guards; tested.

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
  - **B2 — no "end the room" control**, though the scope listed it as a Host power. Added `rooms.endRoom` (Session-Token gated through the shared `hostControl.ts`, cancels the game clock, deletes players then the room) and a confirm sheet on the Host's lobby. **Superseded 2026-08-09:** the Soft Minimal screen replacement removed `endRoom` entirely and replaced it with `players.leaveRoom`, which every player has. **Superseded again by the 2026-08-10 lifecycle decision:** the TV credential owns the production room, so the final player leaves an empty lobby and TV-session expiry closes it. Left here only as the record of what 5.6 shipped.
  - **Also closed, found by the follow-up security review:** the dealt questions carried `correctIndex` for every question and all future question text, so a client reading its own socket had the whole game — first at the opening payload, then (after an incomplete first fix) at every five-second reveal. The projection now withholds unplayed questions on *every* beat and releases an answer only for a question the room has been shown.
  - **Also closed, found by the follow-up code review:** the phones never actually returned to the Join Screen — `players.session` was a one-shot read, so nothing noticed a seat ending, and the end-room copy promised what did not happen. The seated screen now subscribes to its seat, which also covers `removePlayer` and room expiry.
  - **Verify:** `pnpm typecheck` clean (9 workspaces); `pnpm lint` clean; `pnpm test` green — **771 passed, 64 files**. Independent code review and security review both **PASS** on the final tree, each having re-verified the redaction against a real payload.
  - **Historical hardware gap:** the then-current Host-only end-room flow was reviewed by reading rather than exercised. That API and flow were later removed; current hardware coverage follows the leave/TV-recovery checklist in `docs/acceptance-matrix.md`.
  - Residuals recorded here: **5.9** below (the pack ships in the Controller bundle, so a *modified* client can still reproduce the deal) was closed by the follow-up bundle-boundary task. The three smaller ones have since been closed on branch `fix/5.6-residuals`: `expireRoom` now cancels a pending game deadline exactly as the retired `endRoom` did; a player who loses a seat lands on the join form with a line saying why — "The host removed you from the room." when the room is still standing, "This room has closed." when it is not (told apart by the roster on the same Convex snapshot, `apps/controller/src/features/room/seat-loss.ts`); and the confirmation flows share one `ConfirmSheet` shell (surface, scrim, Cancel) rather than duplicating it.

- [x] **5.7 — Align the Controller to the `react-native-tvos` fork**
  - Done: `apps/controller/package.json` now uses `react-native: npm:react-native-tvos@~0.86.0-2`, matching the TV. `pnpm install` re-resolved the controller's whole tree onto the fork and deduped the redundant plain-RN dependency tree (lockfile −442/+27; `--frozen-lockfile` clean). Both apps now resolve one RN fork.
  - Verified: `pnpm typecheck` clean (incl. `apps/controller`); `pnpm test` green (702); `pnpm lint` clean. `expo prebuild --clean` regenerated the controller's iOS project and `pod install` resolved cleanly against the fork (`React-Core 0.86.0-2`; `require('react-native')` → `react-native-tvos@0.86.0-2`) — the dependency-conflict surface this task targets, at both the JS and native layers. A full `xcodebuild`/simulator launch was not run; the fork is the same drop-in the TV already compiles.
  - No `@react-native-tvos/config-tv` and no `EXPO_TV` on the controller, so it stays a phone build.

- [x] **5.8 — (Optional) Remember last-used name and avatar locally**
  - Persist the last-used display name and avatar in AsyncStorage so returning players are prefilled; scope treats this as optional ("the app *may* remember").
  - Done: a pure, unit-tested seam mirroring session parsing — `apps/controller/src/features/join/identity.ts` (parse/recall/remember, injectable store) with `platform/storage/identity-store.ts` as the `AsyncStorage` half. The name and avatar are remembered after a successful `joinRoom` and prefill the join form (seed-only; a `touched` latch never overwrites what the player is entering). Nothing sensitive leaves SecureStore: only the nickname and avatar id go to `AsyncStorage`; the Session Token stays under `platform/session/`. The historical 16-test evidence was later consolidated with the avatar migration.
  - **Verify:** a returning phone prefills its previous name/avatar; nothing sensitive is stored outside SecureStore. Typecheck/lint/tests green; not yet exercised on hardware.

- [x] **5.9 — (Follow-up) Keep the question pack out of the Controller bundle**
  - Raised by 5.6's security review. The wire no longer carries unplayed questions or their answers (`redactStateFor`), but Trivia's curated content was still reachable from the Controller's entry point — `apps/controller` → `@huddle/game-registry` → `@huddle/game-trivia` → `./questions` → `CURATED_PACK` — and `questionsFor` is deterministic, so a **modified** client could reproduce the exact deal locally and know every answer.
  - The redaction is what stops a passive read (the socket, a proxy, an honest client showing too much); this is what would stop a determined one.
  - The fix is structural rather than a projection: the client-side `GameModule` would have to stop carrying `createInitialState`, so the dealing code — and the pack with it — stays on the server. Deliberately not attempted inside 5.6.
  - **Verify:** a production Controller bundle contains no pack question text; the server still deals a game unchanged.
  - **Done** (branch `fix/5.9-pack-out-of-client-bundle`). The fix turned out larger than "stop carrying `createInitialState`": the client's *screens* also pulled `./logic` (and the pack behind it) through pure value helpers (`revealBeat`, `answersIn`, `playersCounted`, `QUESTION_SECONDS`), and the trivia *barrel* re-exported `triviaGameLogic` as a value. Changes: `GameModule` no longer `extends GameLogic` (game-core) — a client type with metadata/settingsSchema/screens and no rules; the pack-free selectors moved to `trivia/src/state.ts` so the screens import them without `./logic`; `settings.ts` takes category names from `trivia/src/content/categories` (drift-guarded by test) instead of `./questions`; the trivia barrel re-exports the module + types only (`export type { … }`, not `export { type … }` — the latter keeps a runtime edge). Guards: an eslint `no-restricted-imports` ban on the server-only content path in client files, and `client-seam.test.ts`. **Verified** by bundling the client registry entry with esbuild — `huddle-classics.json`, `curated-pack.ts`, `questions.ts`, `logic.ts` are absent from the client module graph and no question text is in the output; the server's `games.test.ts` deals unchanged. Independent security review **PASS**.

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
claimed complete. Feature 6 was the resumable implementation stream and is now
complete. It preserves Expo, Convex, the game registry, Soft Minimal
assets/palette, and
the existing public room/game contracts except for the intentional TV APIs and
`createRoom` → `openRoom` replacement.

**Current feature:** —
**Current phase:** —
**Current task:** —
**Last completed task:** 9.1.1 Implement phone screen parity and shared TV Game Setup
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

- [x] **6.3.2a — Compose TV and player recovery boundaries** *(audit resolution F4–F6)*
  - Add durable `playerPaused`, exact shared-remainder preservation across
    overlapping pauses, automatic reconnect resume, Host Continue, Host
    succession, and Controller/TV player-disconnect surfaces. Keep TV-owned
    rooms alive as empty lobbies and cancel/discard their departed game.
  - **Evidence:** `games.test.ts`, `players.test.ts`, `tv-recovery.test.ts`,
    `packages/game-registry/src/running.test.ts`; typecheck, lint, and 71 files /
    823 tests pass.

- [x] **6.3.3 — Stage compatibility fields and define the deployment migration gate**
  - Keep compatibility fields optional in repository code and document the
    required deployment sequence: read-only orphan/legacy audit, separately
    approved cleanup if needed, verification of zero legacy rows, and only then
    schema tightening. No deployment or data mutation was performed. BR-009
    means approved cleanup discards legacy development rows rather than
    interpreting or migrating them into current runtime state.
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

- [x] **6.6.1 — Run automated, export, prebuild, and native-generation verification**
  - Run workflow/task-state checks, typecheck, lint, all tests, pack/avatar
    validation, Expo export/prebuild, Android Leanback resource checks, and
    document the physical-device release matrix separately.
  - Evidence: workflow validator/task-state tests PASS; typecheck and
    lint PASS; full suite PASS; `pnpm validate:packs`
    PASS; avatar `--check` PASS for all ten IDs; Android TV prebuild generated
    Leanback `required=true`, `@drawable/tv_icon`, and `@drawable/tv_banner`;
    Expo Android export PASS. Physical Philips and mixed-phone verification is
    not claimed here; it remains the release checklist in
    `docs/acceptance-matrix.md` because no connected hardware was available.
  - **Traceability:** F-006, J-006, BR-006, BR-007, BR-008, BR-009.
  - **Depends on:** 6.5.2

---

# Feature 7 — F-007 Full-Codebase Behavior-Preserving Refactor

Feature 7 turns the app feature folders into real ownership boundaries, finishes
the private Convex extraction, and makes repository checks match the staged
GitHub delivery workflow. It preserves Expo routes, the Convex schema and all
public APIs except the obsolete `rooms.createRoom`, package exports, and the
approved Soft Minimal visuals/assets.

## Phase 7.1 — Repository guardrails

- [x] **7.1.1 — Establish refactor guardrails and repository truth**
  - Run CI for pull requests and `main`, validate workflow/architecture in CI,
    make ignored local agent state harmless, and make pack validation hermetic.
  - **Depends on:** 6.6.1

## Phase 7.2 — Controller decomposition

- [x] **7.2.1 — Split Controller composition into owned features**
  - Move join, room, picker, game-session, UI, and platform implementation into
    their declared boundaries while preserving session and screen transitions.
  - Evidence: the root screen is 100 lines and owns only deep-link/session
    composition; join, room/roster/host, picker, game-session, credential,
    presence, storage, and Convex code now live behind explicit feature or
    platform entrypoints. The pure seated-surface model covers game,
    paused/unavailable, player waiting, picker, stranded recovery, and empty
    registry states. Typecheck, lint, 70 files / 789 tests, pack/workflow
    validation, both iOS Expo exports, native Controller build/run, and approved
    Join-screen simulator comparison pass with no visual delta.
  - **Depends on:** 7.1.1

## Phase 7.3 — TV decomposition

- [x] **7.3.1 — Split TV composition into owned features**
  - Move Room, carousel, game-session, shared TV UI, and room-session lifecycle
    into their declared boundaries without changing rendering or recovery.
  - Evidence: the TV root screen is 84 lines and owns only room opening, live
    subscriptions, and surface selection. Room, carousel, and game-session own
    their renderers and styles; room-session owns credentials, heartbeat, retry,
    expiry, and lifecycle hooks; `TvStage` is TV UI. A pure surface selector
    covers room, carousel, game, paused, and unavailable states, and architecture
    validation rejects cross-feature deep imports. Typecheck, lint, 71 files /
    794 tests, pack/workflow validation, both iOS Expo exports, and the native TV
    build pass. A regenerated tvOS project links `ExpoCrypto` and
    `ExpoSecureStore`, clearing the stale-native-module runtime error; the live
    Room simulator comparison has no visual delta from the approved Soft Minimal
    capture except its generated room code.
  - **Depends on:** 7.2.1

## Phase 7.4 — Convex consolidation

- [x] **7.4.1 — Finish private helper extraction and retire `createRoom`**
  - Make `openRoom` the only public room opener, consolidate authorization,
    runtime, clock, presence, and deletion helpers, and keep other APIs stable.
  - Evidence: `rooms.createRoom` and the redundant `hostControl` module are
    removed; `openRoom` collision/exhaustion tests exercise the production
    token, rate-limit, and code-draw path. Shared typed database fixtures replace
    unrelated opener calls, and running-state helpers no longer return `any`.
    Authorization, presence, runtime decode/reporting, deadline pause/resume,
    and full room deletion now have one private owner. Typecheck, lint, 71 files
    / 794 tests, pack/workflow validation, and `git diff --check` pass. No Convex
    deployment or data mutation was performed; the required read-only orphan
    audit remains a deployment prerequisite, with cleanup requiring separately
    approved migration work.
  - **Depends on:** 7.3.1

## Phase 7.5 — Full review closeout

- [x] **7.5.1 — Re-audit packages, reconcile truth, and run release verification**
  - Recheck package seams and tooling, record dependency advisories separately,
    reconcile active docs, and run the complete automated/native evidence set.
  - Evidence: game-core, both Registry halves, Trivia, Voting, packs, shared UI,
    custom ESLint rules, and tools were re-audited. Cohesive rules/renderers were
    retained instead of split for line count. Stale room-opening, room-ending,
    one-game, bundle-seam, expiry, and moved-path comments were corrected across
    source, tests, tooling, architecture, acceptance, and design evidence.
  - Boundaries: architecture validation now accepts only one-screen Expo route
    re-exports and detects side-effect/dynamic cross-owner imports. The Registry
    seam test covers default, namespace, side-effect, dynamic, `require`, and
    inline-type value edges into server logic/questions. A non-bytecode
    production Controller export contains none of the sampled pack title or
    question text.
  - Verification: typecheck and lint pass; 71 files / 803 tests pass; pack,
    workflow/architecture, avatar-source, and `git diff --check` validation pass;
    Controller and TV iOS exports pass; Android TV prebuild regenerates required
    Leanback launcher metadata plus the shipped icon/banner; and a tvOS
    simulator build links `ExpoCrypto` and `ExpoSecureStore`. No runtime, schema,
    package-export, design-token, asset, or dependency change was introduced.
  - Historical dependency audit at this task's closeout: eight transitive
    findings (seven high, one moderate, zero critical) are isolated in
    [GitHub issue #34](https://github.com/NderimKrasniqi/huddle/issues/34)
    with exposure and remediation notes. No dependency upgrade is mixed into
    this refactor.
  - Hardware: no physical Android TV or mixed iOS/Android controller set was
    connected, so the documented checklist in `docs/acceptance-matrix.md`
    remains a release check. PR 3's native TV Room simulator comparison remains
    the visual evidence and showed no Soft Minimal delta except its room code.
  - **Depends on:** 7.4.1

---

# Feature 8 — F-008 Platform Startup and Loading Feedback

Feature 8 fills the platform-owned gap between process launch and the first
actionable Room/Join surface. It does not change room/game protocols, pre-game
state, or game-module screens.

## Phase 8.1 — Native startup and platform activity states

- [x] **8.1.1 — Add branded native and in-app startup/loading feedback**
  - Configure both Expo apps with the supplied orange Huddle symbol on the exact
    Soft Minimal canvas for their static native splash.
  - Replace the TV's empty Room/code fallback with a dedicated animated boot
    surface for font startup, room creation, reconnection, and a non-spinning
    configuration failure state over the established TV background.
  - Replace the Controller's font/session blank frames with branded startup and
    session-restoring surfaces; add visible activity feedback to Join, Start,
    Continue/Wait, Leave, Back to lobby, and Host-management mutations; and
    identify TV reconnection explicitly on the paused phone surface.
  - Extend `@huddle/ui` motion with shared fade/scale, brand pulse, activity-dot,
    and screen-transition primitives implemented with React Native `Animated`.
    No Lottie or animation asset/runtime was added.
  - Add pure presentation tests for TV/phone loading states and motion-token
    tests.
  - Verification: typecheck and lint pass; 67 app/package/lint-rule files with
    640 tests and 6 Convex files with 197 tests pass; workflow and pack
    validation pass; production Android exports pass for TV and Controller; and
    clean Android prebuilds emit `Theme.SplashScreen` with `#FFF7F2`, the orange
    Huddle symbol, and the TV Leanback manifest/icon/banner requirements. The
    generated TV project also completes `:app:assembleRelease` (568 tasks,
    release APK produced). Generated splash artwork was inspected at source
    resolution; physical-device cold launch remains in the release matrix.
  - **Depends on:** 7.5.1

---

# Feature 9 — F-009 Phone Screen Parity and Shared Game Setup

Feature 9 adopts the approved phone settings/finished references and the TV
Game Setup surface without moving game-owned rules or gameplay screens into the
platform.

## Phase 9.1 — Shared setup and finished-room actions

- [x] **9.1.1 — Implement phone screen parity and shared TV Game Setup**
  - Add explicit Host-authorized select/configure/cancel mutations and a shared
    setup projection; validate preset/custom settings at the Convex boundary and
    clear the draft atomically when Start locks settings into the runtime.
  - Adopt Standard, Quick, and Custom phone settings flows; mirror the selected
    game and settings on `GameSetupStage` using the approved per-screen dark
    canvas while browsing remains a separate carousel state.
  - Add platform finished screens and Host actions for fresh replay, choosing
    another game, and returning to roster management. Replay requires a finished
    server runtime and carries no question, answer, score, or round state.
  - Keep Trivia's question pack behind the server-only Registry seam and retain
    each module's metadata, settings schema, rendering, rules, and summary.
  - Verification: typecheck, dependency policy, and `git diff --check` pass; 74
    Vitest files with 851 tests pass; CI passes; focused security review found no
    verified vulnerabilities in the changed authorization, validation,
    projection, session, dependency, or client-bundle boundaries.
  - **Depends on:** 8.1.1

- [x] **9.1.2 — Separate game selection from Host settings**
  - Replace the combined carousel-plus-settings column with a dedicated
    `GameSettingsScreen` state after an explicit selection. Keep the state under
    `SeatedController` so room/session subscriptions survive the transition, and
    retain shared setup-draft mirroring on TV.
  - Give the settings state its own compact selected-game summary, preset/custom
    controls, joining notice, Start action, and Change game path. Cancelling a
    selection returns to the carousel instead of leaving its hero above the
    settings controls. Opening the picker publishes its initial card immediately
    so the TV does not wait for the first arrow tap.
  - Verification: Controller typecheck passes; the iPhone Simulator transitions
    from Select Trivia to the dedicated Standard settings screen; Quick changes
    the authoritative preset values; Custom exposes compact numeric, option, and
    category controls; the visible Android TV emulator switches to Game Setup
    and mirrors the selected Quick/Custom values and room code.
  - **Depends on:** 9.1.1

- [x] **9.1.3 — Tighten approved settings composition and startup continuity**
  - Match the approved phone settings hierarchy with large mode tiles, an icon-led
    preset summary, a green joining notice, compact custom rows, and a labelled
    Start action. Keep the authoritative game schema and room-cap rules unchanged.
  - Hold the native splash until the first branded, font-ready React frame on
    Controller and TV; keep phone lobby content top-aligned so short states do not
    float in the middle of a tall handset.
  - Recompose the platform-owned finished phone states around the approved
    result-summary Host board and active-room player board; keep module-owned
    scores and the 2–10 room cap authoritative.
  - Keep the two installed games startable while appending Draw Battle and Word
    Sneak as reference-only carousel placeholders. They share the room's
    browsing index so the Host can scroll through the reference treatment,
    but their disabled Coming soon cards never enter game setup or Convex game
    selection.
  - Verification: cold iPhone launch captures the branded Huddle mark before the
    restored settings screen; Android TV cold launch captures the branded room
    creation surface; Controller/TV typechecks, ESLint, 26 app test files (235
    tests), UI palette/icon tests (28 tests), and `git diff --check` pass.
  - **Depends on:** 9.1.2

---

# Feature 10 — F-010 Architecture, Structure, and Naming Refactor

Feature 10 is a behavior-preserving structural pass. It records the app,
package, Convex, tooling, and testing boundaries before implementation and
keeps public routes, schema/functions, game IDs, registry seams, assets, and
Soft Minimal visuals stable.

## Phase 10.1 — Contracts, documentation, and validation

- [x] **10.1.1 — Record F-010 architecture and naming truth**
  - Add the scope, dependency direction, entrypoint policy, naming vocabulary,
    renderer-test strategy, and TV-away browse rule to the project documents.
- [x] **10.1.2 — Extend architecture validation**
  - Add isolated fixture coverage for forbidden dependency directions, cycles,
    entrypoint contents, and filename conventions before enabling the checks on
    the repository. Preserve the client/server registry seam and parity tests.
- [x] **10.1.3 — Add the shared room-code contract**
  - Export `normalizeRoomCode` from `@huddle/game-core`; use it from join,
    session, and Convex normalization without changing accepted codes.
  - Make host-authorized `games.browseGame` return `null` without changing the
    browsing index while the TV is away, with authorization still first.

## Phase 10.2 — Controller ownership and renderers

- [x] **10.2.1 — Introduce Controller models and seated coordinator**
  - Move `RosterSeat` and lifecycle rejection presentation into `models/`,
    rename the root to `ControllerScreen`, and move seated subscriptions,
    heartbeat/session composition, picker/setup persistence, surface selection,
    and transitions into `screens/seated-controller.tsx`.
- [x] **10.2.2 — Split Controller feature renderers and styles**
  - Separate Room waiting/room renderers, roster, greeting, manage/leave
    sheets, picker browsing/settings/cards/controls, and game-session
    running/recovery/finished/lifecycle controls. Remove the monolithic
    stylesheet and keep reusable control/header/chip/loading styles in `ui/`.

## Phase 10.3 — TV ownership and layout

- [x] **10.3.1 — Introduce TV models and shared header layout**
  - Rename the root to `TvScreen`, move roster projection to `models/roster.ts`,
    and extract `ui/tv-layout.ts` plus `ui/tv-header.tsx` while Room retains
    only Room-specific geometry.
- [x] **10.3.2 — Split TV Room and lifecycle responsibilities**
  - Separate Room stage/code-QR/player-grid/greeting/roster/layout modules;
    rename generic room/session files by responsibility; split opening and
    expiry hooks; remove empty duplicate feature entrypoints and narrow the
    room-session seam.

## Phase 10.4 — Workspace and tooling structure

- [x] **10.4.1 — Move the UI kit and private backend helpers**
  - Place the Huddle Kit implementation in `packages/ui/src/kit/` with stable
    `@huddle/ui/kit` exports, and rename private Convex helper files to
    kebab-case without changing public modules/functions.
- [x] **10.4.2 — Rehome evidence and visual fixtures**
  - Keep executable scripts in `tools/`, move design/regression evidence to
    `docs/evidence/`, and move the visual-fixture manifest/inventory test to
    `test/visual-fixtures/` with updated Vitest paths and documentation.

## Phase 10.5 — Rendered tests and release gates

- [x] **10.5.1 — Add per-app Jest/RNTL projects**
  - Use Jest/jest-expo with RNTL 14.0.1 and the React 19.2 test-renderer line;
    name rendered tests `*.render.test.tsx`, exclude them from Vitest, and run
    both apps from root and CI with async accessibility-first queries.
- [x] **10.5.2 — Run the complete verification set**
  - Cover Controller and TV surfaces, architecture fixtures, TV-away browse,
    room-code normalization, registry parity/isolation, typecheck, lint,
    Vitest/Jest, workflow/packs, dependency/security checks, Expo exports,
    Android TV prebuild metadata, simulator captures, and `git diff --check`.

**Status:** complete for repository automation. Evidence: `pnpm typecheck`,
`pnpm lint`, 74 Vitest files / 859 tests, both Jest rendered suites, isolated
architecture fixtures, `pnpm validate:workflow`, pack validation, and
`git diff --check` pass. Expo exports, Android TV prebuild metadata, and
physical mixed-hardware captures remain release checks because they require
native/device state and are not replaced by rendered tests.

# Feature 11 — F-011 Quality Foundation and Maintainability Pass

Feature 11 records and implements a behavior-preserving maintainability pass.
It removes the private Trivia-pack workspace in favor of owner-local content,
hardens TV identity recovery, follows transitive package seams, and expands
rendered accessibility coverage while preserving public routes, Convex APIs,
game exports, registry ordering, assets, and visuals.

## Phase 11.1 — Record ownership and contracts

- [x] **11.1.1 — Record F-011 truth**
  - Update project scope, architecture, tech-stack, and this implementation
    plan before code changes. Document Trivia content ownership, device-failure
    boot state, package/export rules, catalog, and Node 22/24 gates.

## Phase 11.2 — Trivia content ownership and bundle safety

- [x] **11.2.1 — Move the curated pack into Trivia**
  - Move the JSON, schema/parser, category projection, validation CLI, and
    tests to `packages/games/trivia/packs` and `src/content`; remove
    `@huddle/packs` from the workspace and lockfile while retaining the root
    `pnpm validate:packs` command and unchanged pack behavior.
- [x] **11.2.2 — Preserve the client/server seam**
  - Keep settings dependent only on client-safe categories and keep questions,
    pack parsing, and server logic off the Controller graph. Extend parity,
    production export, and client-content leak tests.

## Phase 11.3 — Reliability and app ownership

- [x] **11.3.1 — Harden TV identity recovery**
  - Add typed SecureStore/UUID device failures, exhaustive boot presentation,
    and tests while preserving durable-token ordering, retry backoff,
    single-flight opening, and log-once behavior.
- [x] **11.3.2 — Thin coordinators and split renderers**
  - Reduce Controller/TV coordinators to lifecycle and surface selection,
    extract Room/session/stage pieces, and consolidate app-local pending,
    action, and inline-error primitives without visual changes.

## Phase 11.4 — Shared UI, games, and Convex ownership

- [x] **11.4.1 — Split shared and game renderers**
  - Split Huddle Kit and Trivia/Voting logic/renderers by responsibility while
    retaining all named exports and preventing client runtime paths to rules or
    content. Add accessibility roles, names, selected/disabled/busy state, and
    TV focus semantics.
- [x] **11.4.2 — Split private Convex helpers and tests**
  - Move private handlers into responsibility-named kebab-case `lib/` modules
    and split large behavior suites without changing public modules,
    validators, schemas, or assertions.

## Phase 11.5 — Validation and release gates

- [x] **11.5.1 — Extend architecture and dependency validation**
  - Add fixture-first transitive import, export-target, workspace-direction,
    rules-only, and client-safe checks. Add the pnpm catalog and Node 22.13 CI
    job alongside Node 24; do not introduce file-length lint rules.
- [x] **11.5.2 — Run the complete verification set**
  - Run pack, pure/backend, rendered Controller/TV/shared, typecheck, lint,
    workflow/architecture, dependency/security, Expo export, Android TV
    prebuild, Node 22/24, and `git diff --check` gates. Record evidence and
    leave physical TV/mixed-controller checks as release work.

**F-011 status:** repository automation is complete. Evidence for this pass:
the Trivia pack validator, 74 Vitest files / 868 tests, Controller and TV Jest
rendered suites (3 suites / 6 tests), typecheck, ESLint, architecture
fixtures, workflow validation, dependency verification, both Expo iOS exports,
the client-bundle seam scan, Android TV prebuild metadata, and
`git diff --check` pass. The production dependency audit could not reach the
npm advisory service in this sandbox; physical mixed-controller captures remain
a native release check.

# Reported QA findings — 2026-08-11

These findings were reported during the simulator and reference-screen review.
They are recorded as follow-up work; none is being marked resolved by this
entry.

- **Simulator target/startup reliability:** make the local run flow reliably
  expose and launch an iPhone Simulator alongside either the Android TV
  emulator or the Apple TV Simulator, with the Controller and TV Metro servers
  using the correct, separate ports. Capture the working target-selection
  commands and the failure symptoms in the release checklist.
- **Reference screen/component parity:** audit the supplied
  `/Users/nderimkrasniqi/Desktop/huddle-expo-tv-phone/src` screens and
  components against the current Controller/TV entrypoints. The supplied
  screens/components are not visibly represented in the running app, so record
  which surfaces are intentionally adapted, which are missing, and which
  routes/components must be wired before considering the reference handoff
  adopted.
- **Unexpected iPhone restore state — first fix complete (2026-08-12):** a
  fresh iPhone now goes straight to the Join surface. `resumeSession` reports
  whether SecureStore found a persisted token, and the restore surface is shown
  only while a found token is being looked up. A returning participant still
  gets the bounded **“Finding your room”** state; a missing, stale, or unreadable
  token falls through to joining. The behavior is covered by session tests.
- **Join-screen visual fidelity — first parity pass (2026-08-12):** the
  Controller **“Join the room”** surface now follows the reference's left-aligned
  title, full-width logo header, compact square code tiles, dark/tightly tracked
  labels, hairline name field, five-by-two avatar rhythm, and solid orange Join
  action. Exact simulator capture comparison remains open for logo scale,
  artwork crop, and device-specific spacing before calling the screen adopted.

## Remaining reference-screen parity audit

The following mappings continue the audit against the supplied
`huddle-expo-tv-phone` screens and the approved images under
`docs/design/reference/screens/`. They describe visual follow-up work, not a
request to discard the current data, authorization, or game-module boundaries.

### Audit run — 2026-08-12

The automated suite is green (74 Vitest files / 859 tests, both rendered Jest
suites, typecheck, lint, and workflow validation). This verifies behavior and
renderability, not pixel equality. XcodeBuildMCP found the configured iPhone 17
and Apple TV targets, but every simulator is currently shut down, so live
screenshot comparison is still blocked. The static screen-by-screen ledger is:

| Surface | Current production entrypoint | Current result | Open parity issues to fix or verify |
| --- | --- | --- | --- |
| Join room | `features/join/join-form.tsx` | First pass applied | Verify logo width/artwork crop and device spacing on a live iPhone; retain 10 live avatars rather than the reference's 8. |
| Your room / Host room | `screens/seated-controller.tsx` | Mismatch remains | Restore the reference's large upper whitespace, 122px wordmark/header, title/code alignment, 40px rows, and Host/Just-joined/Away/online treatments. |
| Pick a game | `features/game-picker/game-picker-screen.tsx` | Mismatch remains | Reconcile illustrated Trivia art/crop, icon chips, chevrons, pager, help copy, and CTA while keeping the live 2–10 range. |
| Game settings — Standard | `features/game-picker/game-picker-screen.tsx` | Mismatch remains | Compare summary card, mode tile/check badge, summary rows, joining notice, and bottom CTA. |
| Game settings — Quick | `features/game-picker/game-picker-screen.tsx` | Mismatch remains | Verify Quick-specific tile selection, summary values, spacing, and CTA against `07-game-settings-host-quick.png`. |
| Game settings — Custom | `features/game-picker/game-picker-screen.tsx` | Mismatch remains | Compare steppers, pills, category row, draft-state persistence, notice, and CTA against `08-game-settings-host-custom.png`. |
| Category picker | `features/game-picker/category-picker-sheet.tsx` | Mismatch remains | Match sheet height, grabber/title spacing, row/divider geometry, selected check, scrim, Done, and Cancel. |
| Manage player | `screens/seated-controller.tsx` | Mismatch remains | Match bottom-sheet geometry, away avatar, disabled Make-host row, explanatory copy, Remove, and Cancel without weakening authorization. |
| Waiting player | `features/game-session/game-session-screen.tsx` | Mismatch remains | Match host avatar, “is choosing…” typography, green status card, gamepad/info card, and vertical spacing while retaining Leave/live data. |
| Finished player | `features/game-session/game-session-screen.tsx` | Mismatch remains | Match wordmark/avatar/artwork, completion copy, active-room and host/controller cards, and celebration treatment. |
| TV room lobby | `features/room/room-stage.tsx` | Mismatch remains | Recheck code tile proportions, QR quiet zone, divider contrast, background scale, safe-area exception, and roster spacing. |
| TV game carousel | `features/carousel/carousel-stage.tsx` | Mismatch remains | Add/verify illustrated art, overlay icon chips, chevrons, five-dot pager, browsing footer glyph, and card treatment. |
| TV game setup | `features/game-setup/game-setup-stage.tsx` | Structural mismatch | Compare fixed Trivia hero/dark canvas, left rule list, right QR/code block, and bottom roster strip against `03-game-setup.png`. |
| Shared components / preview shells | `packages/ui/src/kit/*`, app feature UI | Intentional adaptation, not 1:1 | Decide which reference geometry/assets belong in shared primitives and whether a dev-only deterministic preview harness is needed. |

- **Host room** — `HostRoomScreen` → the `SeatedController` room surface:
  reconcile the reference's full-width 122px wordmark/header, large upper
  whitespace, title/code alignment, 40px avatar rows, and explicit Host/
  Just-joined/Away/online treatments with the current compact token-native
  header, roster rows, and room-code chip. The 10-player cap remains an
  intentional product decision even where the sample board shows 6 of 12.
- **Pick a game** — `PickGameScreen` → `PickAGameScreen`: compare the supplied
  illustrated Trivia card, card height/art crop, metadata chips with icons,
  arrow controls, pager, help copy, and CTA against the current registry-driven
  `GameKeyArt` card and carousel controls. The installed catalog and 2–10
  range remain authoritative; the board's unavailable games and 2–12 sample
  copy are reference-only.
- **Game settings (Standard / Quick / Custom)** — `GameSettingsScreen` → the
  nested `GameSettingsScreen` and `SettingsControls`: reconcile the supplied
  `trivia-phone.png` summary card, mode-tile dimensions/icons/check badge,
  summary rows, custom steppers/pills/category row, joining notice, and bottom
  CTA with the current schema-driven key-art summary, `InfoChip` row, dynamic
  controls, and shared token styles. Verify each of the three approved image
  states independently; do not replace authoritative module settings with
  sample text from the board.
- **Category picker** — `CategoryPickerScreen` → `CategoryPickerSheet`:
  compare the sheet height, grabber/title spacing, row height/dividers,
  selected check treatment, scrim, Done button, and Cancel action. The current
  sheet is dynamic and modal-backed, while the reference is a fixed category
  snapshot over the settings surface; preserve live draft state while matching
  the visual treatment.
- **Manage player** — `ManagePlayerScreen` → `ManagePlayerSheet`: compare the
  bottom-sheet geometry, Taylor/away avatar treatment, disabled Make-host row,
  explanatory copy, destructive Remove button, and Cancel spacing. The current
  sheet intentionally supports live Online/Away state and host-control
  authorization, so parity work must change presentation without weakening
  those behaviors.
- **Waiting player** — `WaitingPlayerScreen` → `WaitingScreen`: reconcile the
  no-action header, host avatar size/art, “is choosing…” typography, green
  status card, gamepad/info card, and vertical spacing. The current surface adds
  the room-wide Leave control and uses live host/game data; those are behavior
  requirements to retain while matching the reference composition.
- **Finished player** — `GameFinishedPlayerScreen` → `FinishedScreen` (player
  branch): compare the 149px wordmark, 188px avatar/fox artwork, title and
  completion copy, active-room card, host/controller card, and bottom
  celebration asset. The current branch uses dynamic module art, a smaller
  token-native avatar, vector controller icon, and a token-native celebration
  fallback; decide whether supplied assets can be adopted without breaking
  game-agnostic rendering.
- **TV Room and TV carousel** — `TVRoomLobbyScreen` / `TVGameCarouselScreen`
  → `RoomStage` / `CarouselStage`: the measured deltas and intentional
  exceptions remain in `docs/design/pixel-parity.md` (tile/QR sizing, divider
  contrast, safe-area/background scale, illustrated card art, chip icons,
  chevrons, pager, and browsing footer). Re-run the comparison on the current
  tree rather than treating the historical capture as resolved.
- **TV Game Setup** — `TVGameSetupScreen` → `GameSetupStage`: compare the
  supplied dark canvas's fixed Trivia hero (`trivia-setup-hero.png`), left rule
  list/host line, right QR/code block, and bottom roster strip with the current
  flex layout, schema-driven summary rows, generated QR card, live-mirroring
  pill, and current background asset. This is a structural visual delta even
  though the setup protocol and live roster mirroring are implemented.
- **Shared reference components** — `PhoneHeader`, `PhoneScreen`, `Common`,
  `GameSettingsComponents`, `TVCommon`, `HuddleLogo`, and `Icon` are not
  currently imported as a 1:1 replacement. The app uses `@huddle/ui` tokens,
  native primitives, and the feature renderers instead. Inventory which
  reference geometry/assets should be ported into those primitives, and which
  differences are deliberate system-level adaptations, before claiming the
  supplied component handoff has been adopted.
- **Phone preview shell** — `PreviewNavigator` (and the reference `src/index.ts`)
  is a standalone menu that can walk through Join, Host, Manage, Pick, all
  three settings modes, Category, Waiting, and Finished states. The current
  Controller launches through Expo Router into the live Convex-backed
  `ControllerScreen`; it has no equivalent reference preview menu. Decide
  whether a dev-only parity harness is required so every reference state can be
  captured deterministically without live room data.
- **TV root and preview shell** — `TvScreen`, `TVPreviewApp`, and the
  reference `tv/types.ts` provide a demo view model plus Room/Browse/Setup phase
  cycling (including D-pad LEFT/RIGHT). The current `TvScreen` is a production
  Convex/session coordinator and does not expose that standalone preview shell.
  Record whether the preview-only router should be ported as a dev tool or
  intentionally remain reference-only.
- **TV canvas and focus primitives** — `TVCanvas` authors directly against the
  supplied 1672×941 artboard and `TVFocusable` supplies optional D-pad focus
  styling. The current `TvStage` authors a 1280×720 stage with a title-safe
  scale over the live background, and current TV surfaces are display-only with
  no `TVFocusable` equivalent. Reconcile the coordinate-system choice,
  background scaling, overscan behavior, and any future remote-focus treatment
  before calling the TV shell pixel-parity complete.
- **Duplicate TV screen paths** — the reference has both
  `src/screens/TVGameCarouselScreen.tsx`, `TVGameSetupScreen.tsx`, and
  `TVRoomLobbyScreen.tsx` and the parallel `src/tv/screens/*` versions. The
  current app intentionally maps these to feature-owned `CarouselStage`,
  `GameSetupStage`, and `RoomStage` rather than preserving those file paths.
  Verify that the mapping is complete and that no preview-only copy is being
  mistaken for the production surface.

# Deferred post-MVP and release work

These are real follow-ups, not completed numbered tasks:

- Design the five implemented surfaces still missing approved treatment: TV
  Game frame, TV recovery status, phone Leave sheet, phone Game frame, and
  phone recovery status.
- Complete game-art coverage and metadata wiring, replace the interim
  `accent-face` treatment when game-screen designs land, and decide whether the
  join form should subscribe early enough to dim already-taken avatars.
- Distinguish client/runtime failures from network failures in the TV
  `openRoom` error surface.
- Before a Convex deployment that removes compatibility, run the read-only
  orphan/legacy audit; any cleanup or schema tightening requires separately
  approved migration work.
- Re-run the physical Android TV plus mixed iOS/Android controller matrix,
  including camera deep links, recovery, Host controls, late join, and
  back-to-back Trivia/Voting, before release.
