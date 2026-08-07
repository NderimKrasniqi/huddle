# Implementation Plan

## Phase 1 — Create and Join a Live Room

**Outcome:** A locally built Android TV creates a room, native iOS/Android phones join it, and all clients see the same lobby.

- [ ] **1.1 — Establish the monorepo and local build baseline**
  - Create `apps/mobile`, `apps/tv`, shared packages, and the Convex backend.
  - Configure Expo SDK 57, `react-native-tvos@0.86-stable`, Expo Router, NativeWind v4, pnpm workspaces, and common TypeScript settings.
  - Add the minimum local run/build scripts for iOS phone, Android phone, and Android TV.
  - Wire Convex providers into both client apps.
  - Add baseline typecheck and test commands.
  - **Verify:** clean install succeeds; both apps typecheck; Android TV, Android phone, and iOS phone can each launch locally.

- [ ] **1.2 — Create authoritative room state**
  - Model rooms and participants in Convex with indexes for room-code and room-membership reads.
  - Generate unique 4-character room codes.
  - Make the TV create/recover its room identity and expose room status reactively.
  - Add room lifecycle validators and backend tests.
  - **Verify:** room creation is transactional; duplicate active codes are prevented; room lookup is indexed and tested.

- [ ] **1.3 — Build the TV lobby**
  - Display the room code, QR join payload, room status, and empty lobby.
  - Keep the QR destination native-app-only; do not introduce a browser controller or web join flow.
  - Handle loading, invalid room recovery, and TV-created room restoration.
  - **Verify:** the QR resolves to the correct native join flow and entering the code manually reaches the same room.

- [ ] **1.4 — Build native phone joining and participant identity**
  - Add join-by-code plus native QR scanning/deep-link handling, choosing the simplest reliable native path during implementation.
  - Let players choose a display name and built-in avatar.
  - Store name/avatar preferences in AsyncStorage.
  - Issue and store a participant/session credential in SecureStore.
  - Enforce the platform ceiling of 12 players.
  - Make the first joined player host.
  - **Verify:** two or more phones join the same room, receive distinct identities, and only the first receives host authority.

- [ ] **1.5 — Complete the reactive room lobby**
  - Show the live participant roster and host identity on TV and phones.
  - Preserve the room when all players leave while the TV remains connected.
  - Make the next player become host when a hostless empty room receives a join.
  - **Verify:** joins/leaves update all clients without manual refresh and the empty-room behavior matches scope.

## Phase 2 — Select and Run a Modular Game

**Outcome:** The host selects/configures a game from the phone, the TV mirrors that choice, and the voting game runs end-to-end through a generic game runtime.

- [ ] **2.1 — Define the platform game contract**
  - Define game metadata, min/max players, configuration, lifecycle states (including pause/recovery), commands, public TV state, and participant-private state.
  - Define how games declare late-join safe points, continue-after-leave behavior, optional additional readiness, and host pause/resume capability.
  - Treat lobby join as ready by default unless a game explicitly requires more.
  - Keep the contract independent of Trivia and Voting specifics.
  - **Verify:** both planned MVP games can be described through the contract without platform-specific exceptions.

- [ ] **2.2 — Build the game catalog and host configuration flow**
  - Register the built-in games.
  - Let the host browse/select a game from the phone.
  - Mirror highlighted/selected game information and configuration on TV.
  - Enforce game min/max player compatibility before start.
  - Lock configuration when the game starts.
  - **Verify:** non-hosts cannot select/start games; incompatible player counts block start with a clear reason.

- [ ] **2.3 — Implement the generic game-session lifecycle**
  - Add room → configuring → active/paused → finished → room transitions.
  - Make start, supported pause/resume, end-game, replay, and end-room commands host-authorized.
  - Ensure ending a game discards unfinished game state but preserves the room, participants, avatars, and host.
  - Ensure ending the room invalidates the room/session rather than returning to the lobby.
  - **Verify:** repeated game sessions do not leak prior game state, room identity remains stable between games, and an ended room cannot accept new actions.

- [ ] **2.4 — Build the voting/test game as the first module**
  - Implement one simple prompt-and-vote loop using the generic contract.
  - Keep each participant's vote private until reveal.
  - Show appropriate shared prompt/result state on TV.
  - **Verify:** Voting can be added/run without adding Voting-specific logic to room/session infrastructure.

- [ ] **2.5 — Enforce authorization and privacy boundaries**
  - Validate every public Convex function input and return shape.
  - Require participant/session credentials for participant actions.
  - Require host authority for host commands.
  - Ensure room codes alone cannot impersonate a participant or host.
  - Ensure private game state is projected only to the entitled participant.
  - **Verify:** backend tests prove unauthorized host commands and private-state reads are rejected.

## Phase 3 — Survive Disconnects and Ownership Changes

**Outcome:** Phone, host, and TV interruptions recover predictably without corrupting room/game state.

- [ ] **3.1 — Add presence and background grace periods**
  - Track last-seen/heartbeat state for phones and TV.
  - Avoid treating brief screen locks/backgrounding as immediate disconnects.
  - Use authoritative timestamps and scheduled checks rather than client-local disconnect decisions.
  - **Verify:** fake-time tests distinguish temporary backgrounding from a real disconnect.

- [ ] **3.2 — Recover ordinary players**
  - Preserve disconnected participant identity and relevant active-game state during the recovery window.
  - Pause active gameplay after a player is classified disconnected.
  - Restore the same participant when the valid SecureStore credential reconnects.
  - Let the host wait, continue if the game permits it, or remove the participant.
  - Make removal invalidate the old participant state while allowing a later fresh join.
  - **Verify:** reconnect restores identity/state; removed participants cannot reclaim the old participant slot.

- [ ] **3.3 — Handle host transfer and loss**
  - Support manual host transfer.
  - On deliberate host leave, transfer to the longest-connected eligible remaining player before removal.
  - On unrecovered host disconnect, promote the longest-connected eligible connected player.
  - Preserve hostless empty-room behavior.
  - **Verify:** ownership transitions are deterministic and stale clients cannot retain host authority.

- [ ] **3.4 — Recover the TV or close the room**
  - Pause active gameplay when the TV is classified disconnected.
  - Preserve room/game state for a TV recovery window.
  - Restore the same room/game when the TV returns.
  - Close and clean up the room when the recovery window expires.
  - **Verify:** recovery resumes the existing session; expiry makes the old room code unusable.

- [ ] **3.5 — Enforce game rules during membership changes**
  - Apply each game's late-join policy.
  - Keep unsupported late joiners in the room but outside active gameplay.
  - Prevent continuation when active participants fall below the game's minimum.
  - Allow continue-without-player only when the game explicitly supports it and minimums remain satisfied.
  - **Verify:** lifecycle tests cover late join, continue, wait, remove, below-minimum, and end-game paths.

- [ ] **3.6 — Run lifecycle regression tests with fake time**
  - Cover player/host/TV timeouts, scheduled transitions, cleanup, and concurrent reconnect attempts.
  - Check that repeated interruption/recovery cannot create duplicate participants or multiple hosts.
  - **Verify:** backend lifecycle suite is deterministic and passes under fake timers.

## Phase 4 — Build the Full Trivia Game

**Outcome:** A complete multiplayer Trivia game exercises the platform's private inputs, shared TV state, timers, rounds, scoring, and recovery behavior.

- [ ] **4.1 — Define Trivia metadata, rules, and built-in content**
  - Add a small curated built-in question set.
  - Define supported player range, round/question count, answer duration, scoring rules, and late-join/continue behavior.
  - Expose the configuration through the generic game contract.
  - **Verify:** Trivia can be selected/configured without platform changes.

- [ ] **4.2 — Implement the authoritative Trivia state machine**
  - Model round/question/answer/reveal/result states.
  - Validate answer eligibility and one-answer-per-player rules.
  - Store authoritative deadlines instead of per-second countdown state.
  - Use Convex scheduled functions to close timed phases.
  - Compute scoring server-side.
  - **Verify:** `convex-test` covers valid/invalid answers, deadline enforcement, scoring, and state transitions.

- [ ] **4.3 — Build the phone Trivia experience**
  - Show participant-private answer controls and submission state.
  - Prevent answer changes after rules/deadlines disallow them.
  - Integrate reconnect and waiting/paused states.
  - **Verify:** UI tests cover answer submission, locked state, pause, reconnect, and result transitions.

- [ ] **4.4 — Build the TV Trivia experience**
  - Show shared question content, answer countdown, round progress, reveal/results, scoreboards, and podium.
  - Render countdowns locally from the authoritative deadline.
  - Never expose another participant's private answer before the reveal state permits it.
  - **Verify:** TV UI follows backend lifecycle state and does not depend on local authoritative decisions.

- [ ] **4.5 — Integrate Trivia with platform interruption rules**
  - Exercise late join, ordinary-player disconnect, host disconnect/transfer, below-minimum handling, and TV recovery.
  - Define whether/when Trivia can continue without a disconnected player.
  - **Verify:** interruption scenarios produce the same outcomes defined by the platform contract.

- [ ] **4.6 — Finish, replay, and return to room**
  - Complete final scoring/podium behavior.
  - Support replay through a new clean Trivia session.
  - Return to the existing room and allow selection of Voting or Trivia again.
  - **Verify:** multiple back-to-back games do not leak scores, answers, timers, or prior configuration.

## Phase 5 — Harden the Local MVP

**Outcome:** The complete MVP is reliable enough to run locally on Android TV plus iOS/Android phones and is checked against the approved scope.

- [ ] **5.1 — Handle join and network failure UX**
  - Add clear states for invalid/expired codes, full rooms, unavailable backend, reconnecting, and ended rooms.
  - Prevent duplicate submissions caused by retries/reconnects.
  - **Verify:** failure-state tests and manual checks produce actionable UI instead of silent failure.

- [ ] **5.2 — Harden the Android TV shared display**
  - Verify large-screen layout, overscan/safe-area behavior, typography, animations, and readability at living-room distance.
  - Confirm NativeWind v4 behavior on Android TV for the actual display components used.
  - Ensure no room/game flow accidentally requires TV remote input.
  - **Verify:** every MVP flow can be completed from phones while the TV remains a shared display only.

- [ ] **5.3 — Harden phone app lifecycle and deep links**
  - Verify foreground/background transitions, lock/unlock, QR deep links, cold starts, and reconnection credentials.
  - Ensure short interruptions do not trigger false disconnects.
  - **Verify:** iOS and Android manual lifecycle matrix passes.

- [ ] **5.4 — Run the multiplayer acceptance matrix**
  - Exercise 1–12 room members where supported by the selected game.
  - Test mixed iOS/Android controllers with Android TV.
  - Test host participation, host transfer, player removal/rejoin, late join, TV recovery, and back-to-back games.
  - **Verify:** all approved MVP workflows have at least one passing automated or documented manual check.

- [ ] **5.5 — Finalize local build and verification commands**
  - Make clean local builds reproducible for Android TV, Android phone, and iOS phone.
  - Ensure typecheck, backend tests, and client tests are single-command operations from the workspace root.
  - **Verify:** a clean checkout can install, test, and launch every MVP target using the documented commands.

- [ ] **5.6 — Perform final scope/architecture review**
  - Re-read `project-scope.md`, `tech-stack.md`, and this plan against the implemented behavior.
  - Remove accidental MVP scope and fix any missing required behavior.
  - Confirm no unnecessary server, realtime, state-management, cloud-build, or persistence infrastructure was introduced.
  - **Verify:** every MVP requirement maps to completed behavior and no blocking discrepancy remains.
