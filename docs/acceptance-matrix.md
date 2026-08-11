# MVP Acceptance Matrix

> **Task 5.4 — the multiplayer acceptance matrix across both games.**
> Every approved MVP workflow (`docs/project-scope.md`) mapped to at least one
> passing check, with the **second game (Voting) included** alongside Trivia.

## Method

- **Automated** rows cite a passing test suite by file and, where it helps,
  `describe`/`it`. The whole suite is `pnpm test` — **71 files, 825 tests, 0
  failures** in the 2026-08-11 reconciliation (the historical Phase 5
  baseline was 62 files / 721 tests).
- The hub (`convex/convex/{rooms,players,games}.ts`) is game-independent: it
  never names a game and dispatches to whatever the Registry installs. So a
  workflow that runs *through* the hub without touching game rules (host
  transfer, presence, room expiry, join) is proven **once, game-agnostically** —
  running it a second time with Voting would exercise the same code. Those rows
  are marked **game-agnostic**.
- Workflows that **do** reach a game's own rules (start/range/settings, events,
  the game's clock, end/replay/switch, late-join, away-in-game) are the ones
  that must include the second game. Until this task they ran through the hub
  only with Trivia; `convex/convex/voting-lifecycle.test.ts` (20 tests, added
  here) now runs the same platform workflows with `gameId: 'voting'`. That file
  is this matrix's "second game included" backbone.
- **Manual** rows are workflows that need real hardware — two phone OSes, a
  physical Android TV, a phone camera scanning a QR — that no automated suite in
  this repo can stand in for. They cite the documented device runs from 5.3
  (see git history) and are re-confirmed per release.
- **Gap** rows are approved scope with no implementation to check. Historical
  conflicts remain in **Findings** with their product resolution and evidence.

Legend: ✅ automated · 🔁 game-agnostic (proven once) · 🧪 manual · ⛔ gap

---

## Room lifecycle

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| TV launch creates a room with a 4-char code | 🔁 | 🔁 | `rooms.test.ts` › openRoom code generation; unique, redraw-on-collision/exhaustion |
| Room persists across games; ending returns to the same room | ✅ | ✅ | `games.test.ts` › ending (roster/host/code intact); `voting-lifecycle.test.ts` › "returns the room to its lobby with roster, host and code intact" |
| Switching games returns to the room, no state carried | ✅ | ✅ | `voting-lifecycle.test.ts` › "switches between the two games, carrying nothing across" (Voting→Trivia→Voting) |
| Empty room stays open while TV holds; next joiner hosts | 🔁 | 🔁 | `players.test.ts` › "keeps a TV-owned room open with the same code after the last player leaves"; last-player game cleanup/cancel coverage beside it |
| Room closes when its recovery/expiry window lapses; state discarded | 🔁 | 🔁 | `tv-recovery.test.ts` › "expires after ten minutes silent" (room, players, TV session, and game removed; code reusable) |

## Platform startup and loading feedback

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| TV and phone native launch use the Huddle symbol on the Soft Minimal canvas | 🔁 | 🔁 | `apps/{tv,controller}/app.json` splash config; fresh Android prebuild/resource inspection; both production Android exports; generated TV `:app:assembleRelease` APK |
| TV startup/open/reconnect/configuration failure never shows empty Room Code or QR placeholders | 🔁 | 🔁 | `apps/tv/src/features/boot/boot-state.test.ts`; `TvRoomScreen` gates `RoomStage` behind `opening.kind === 'open'` |
| Phone font startup and Session Token restoration show branded progress rather than returning `null` | 🔁 | 🔁 | `apps/controller/src/ui/loading-state.test.ts`; root layout and `ControllerScreen` loading branches |
| Join, Start, Continue/Wait, Leave, Back to lobby, and Host-management pending actions show activity and expose accessibility busy state | 🔁 | 🔁 | Shared `LoadingIndicator` plus owning Controller controls; lifecycle authorization remains covered by the existing app/Convex suites |

## Joining and identity

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Join by 4-char code | 🔁 | 🔁 | `players.test.ts` › joinRoom; `apps/controller/src/features/join/join-entry.test.ts` |
| Join by scanning the TV QR (phone OS camera → deep link) | 🧪 | 🧪 | Manual (5.3 device runs); QR payload built in `apps/tv` + `packages/game-core/src/join-link.test.ts` |
| Choose display name + built-in avatar before joining | 🔁 | 🔁 | `apps/controller/src/features/join/identity.test.ts`, `join-entry.test.ts`; `players.test.ts` › avatar validation and join identity |
| Session Token issued and stored in SecureStore; validated server-side | 🔁 | 🔁 | `players.test.ts` › session; `apps/controller/src/platform/session/session.test.ts`; `packages/game-core/src/session-token.test.ts` |
| Simultaneous joins seat one host, no lost seats | 🔁 | 🔁 | `players.test.ts` › "joinRoom under simultaneous joins", "hands one host to a room a dozen phones join at once" |
| Room code locates a room but is never authorization | 🔁 | 🔁 | `games.test.ts`/`players.test.ts` — every mutation gates on the Session Token, not the code |
| iOS **and** Android controllers with an Android TV | 🧪 | 🧪 | Manual (5.3 device runs); one automated logic layer serves both OSes (tech-stack: RN client logic in `apps/*/src`) |

## Players and capacity

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Up to 10 players in a room (`ROOM_PLAYER_CAP`) | 🔁 | 🔁 | `players.test.ts` › joinRoom (roomFull at the cap); `packages/game-core/src/room-capacity.ts` = 10 |
| Each game declares its own player range; start gated on both minimum and maximum | ✅ | ✅ | Trivia 2–10 `games.test.ts` › "refuses a party smaller than the game is playable by"; Voting 2–10 `voting-lifecycle.test.ts` › "refuses a party below Voting's declared minimum"; shared maximum gate in `packages/game-core/src/room-phase.test.ts` and Host preflight in `apps/controller/src/features/game-picker/game-controls.test.ts` |

## Host controls

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Browse / select / draft settings for a game on the phone | ✅ | ✅ | `game-registry` carousel/registry/logic suites; `apps/controller/src/features/game-picker/settings-choice.test.ts`, `apps/controller/src/features/room/host.test.ts` |
| Start a game; non-host start refused | ✅ | ✅ | `games.test.ts` + `voting-lifecycle.test.ts` › "refuses a phone that is not the Host" |
| Settings locked at start (re-start refused mid-game) | ✅ | ✅ | `games.test.ts`/`voting-lifecycle.test.ts` › "refuses to start a second game over the one being played" (`alreadyInGame`) |
| End the active game; discard state, keep room | ✅ | ✅ | `games.test.ts`/`voting-lifecycle.test.ts` › ending |
| Finished Host can replay fresh state, choose another game, or return to roster management | ✅ | ✅ | `games.test.ts` › shared setup/replay; `apps/controller/src/features/game-session/game-session-screen.tsx` › `FinishedScreen`; replay/end remain Host-authorized Convex mutations |
| Leave one's own seat; final departure returns the TV-owned room to an empty lobby | 🔁 | 🔁 | `players.test.ts` › leaveRoom, TV-owned empty-room/code retention, active-game discard and deadline cancellation |
| Host is also a normal player; can act in the game | ✅ | ✅ | `games.test.ts` › "is open to every player, not only the Host"; Voting votes from the host seat in `voting-lifecycle.test.ts` |
| Host cannot read another player's private state | ✅ | 🔁 | Trivia: `games.test.ts`/`players.test.ts` private-projection; Voting has **no** private per-player state — the tally is anonymous (`voting-lifecycle.test.ts` › "keeps the tally anonymous") |
| **Manually transfer host status** | 🔁 | 🔁 | `players.test.ts` › host controls › transferHost + `apps/controller/src/features/room/host-controls.test.ts` (row offers, away-target disable) — task 3.7, see Findings F1. |
| **Remove a player** | 🔁 | 🔁 | `players.test.ts` › host controls › removePlayer + `apps/controller/src/features/room/host-controls.test.ts` — task 3.7, see Findings F2. |

## Game selection and configuration

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Catalog + metadata (name, art, range, duration, modes) | ✅ | ✅ | `game-registry` browsing/carousel suites; both modules' client-safe metadata in `packages/games/*/src/metadata.ts` |
| Host scrolls games on the phone; TV follows the highlighted carousel card | 🔁 | 🔁 | `games.test.ts` › browsing query; `apps/tv/src/features/carousel/carousel-footer.test.ts` |
| Explicit game selection switches the TV from Browse Games to Game Setup | ✅ | ✅ | `games.test.ts` › shared setup draft; `apps/tv/src/screens/tv-surface.test.ts`; `apps/tv/src/features/game-setup/game-setup-stage.tsx` |
| Host changes settings on the phone; TV Game Setup mirrors draft settings before Start | ✅ | ✅ | `games.test.ts` › "selects a preset, mirrors configuration, and starts atomically"; `packages/game-core/src/game-settings.test.ts`; Controller picker setup mutation wiring |
| Start is a phone action that locks settings and enters the game runtime | ✅ | ✅ | `games.test.ts`/`voting-lifecycle.test.ts` › start validation and `alreadyInGame` lock |
| Settings settled against the game's own schema (validate/default) | ✅ | ✅ | Trivia (3 settings) `games.test.ts`; Voting (1 setting) `voting-lifecycle.test.ts` › "starts on the rounds the Host chose…", "refuses a value…", "refuses a setting…" |
| A game the build does not install is refused | 🔁 | 🔁 | `games.test.ts` › "refuses a game the Registry does not install" |

## Playing a game

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Player event reaches the module; room keeps the result | ✅ | ✅ | `games.test.ts` › event suite; `voting-lifecycle.test.ts` › "carries the vote to the module…" |
| Event attributed by Session Token, never by the phone's claim | ✅ | ✅ | Both suites › "names the {player,voter} from the Session Token, never from the phone" |
| Private input stays private; only shared state on the TV | ✅ | ✅ | Trivia private answers `answering.test.ts`; Voting privacy is **structural** — `voting-lifecycle.test.ts` asserts the payload holds no voter→choice map |
| Simultaneous inputs without races | ✅ | 🔁 | Trivia `games.test.ts` › "takes a whole party answering at once"; same transaction path serves Voting votes |
| Authoritative timers; clients render countdowns locally | ✅ | ✅ | Trivia clock + forged-player-event rejection in `games.test.ts`; Voting both beats + forged-player-event rejection in `voting-lifecycle.test.ts` |
| A whole game plays out to a finish | ✅ | ✅ | Trivia `playToTheFinalScores`; Voting › "plays a whole game to finished on its own clock, with no phone input" |
| Rounds / scoring / results | ✅ | n/a | Trivia scoring `games.test.ts` + `packages/games/trivia`; Voting is scoreless by design (proves modularity) |
| Shared TV gameplay surface (question/prompt, timer, results, podium) | 🔁 | 🔁 | `apps/tv/src/*`; `packages/games/trivia/src/watching.test.ts`, `packages/games/voting/src/voting-tv.test.ts` |

## Late joining

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| A player may always join the room while it exists | 🔁 | ✅ | `voting-lifecycle.test.ts` › "leaves a mid-game joiner in the room but out of the game" |
| A latecomer sees room status but does not enter active play or get private info | ✅ | ✅ | Trivia standings fixed at start `packages/games/trivia`; Voting `players` fixed at start, latecomer's vote ignored (`voting-lifecycle.test.ts`) |

## Presence, disconnect and recovery

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Brief backgrounding is not an immediate disconnect (grace period) | 🔁 | 🔁 | `players.test.ts` › presence ("marks a backgrounded phone away — after ten seconds…"); `packages/game-core/src/presence.test.ts` |
| After Host Continue, reducers do not wait for away players | ✅ | ✅ | Generic pause/Continue coverage in `games.test.ts`; Trivia away-player injection there; Voting `voting-lifecycle.test.ts` › "reveals past an away player" |
| Reconnect with the valid credential restores the same participant | 🔁 | 🔁 | `players.test.ts` › presence/session ("brings a player back the moment their phone beats again"); `apps/controller/src/platform/presence/presence.test.ts` |
| Host disconnect → longest-connected eligible player becomes host | 🔁 | 🔁 | `players.test.ts` › host transfer ("hands the room to the longest-connected active player", "moves the room inside the fifteen seconds a host may be gone for", "passes over players who have gone quiet") |
| Active player/Host disconnect pauses for the current Host's Wait/Continue decision | 🔁 | 🔁 | `games.test.ts` › "a running game when a player disconnects": ordinary pause, Host succession, inert input, Wait/reconnect, Continue authorization; client projection in `game-registry` |
| Player range gates start only; Host may continue below minimum | 🔁 | 🔁 | `games.test.ts` › "resumes the exact remainder when the Host continues below the starting minimum"; both games' start-range tests remain green |
| TV disconnect → room pauses, preserves its exact beat, then closes after the recovery window | ✅ | ✅ | `convex/convex/tv-recovery.test.ts` and `rooms.test.ts`: durable TV heartbeat, one silence-check chain, 13-second away transition, exact remainder, paused gameplay gate, and ten-minute expiry |
| Back-to-back games, including switching between the two | ✅ | ✅ | `voting-lifecycle.test.ts` › "switches between the two games…", "replays Voting from a clean state" |

## Persistence and scope boundaries

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Room/game state ephemeral; discarded when the room closes | 🔁 | 🔁 | `tv-recovery.test.ts` › "expires after ten minutes silent" deletes the production room, players, game, and TV-session row |
| No score carried between games | ✅ | ✅ | `games.test.ts` › "leaves its scores behind"; `voting-lifecycle.test.ts` › switching carries nothing across |
| Only convenience prefs (last name/avatar) may persist locally | n/a | n/a | Implemented in `apps/controller/src/features/join/identity.ts` through `apps/controller/src/platform/storage/`; player and TV Session Tokens remain in SecureStore under their respective platform session owners |

---

## Findings

**F1 — Manual host transfer — RESOLVED by task 3.7 (backend).** Was: scope
lists "manually transfer host status" but only automatic `handOverRoom` existed.
Now implemented as the host-authorized `transferHost` mutation
(`convex/convex/players.ts`): hands the room to a chosen **connected** player,
refuses a non-host caller / stale token / out-of-room target / the host's own
seat / an away target. Covered by `players.test.ts` › host controls; independent
security review PASS. **Wired into the UI (task 3.7):** the Host Roster's manage
sheet (`apps/controller/src/features/room/seated-screen.tsx`) — a non-Host row opens a Soft Minimal
confirm dialog whose "Make host" runs `transferHost`, dimmed for an away target;
`docs/design/soft-minimal-handoff.md` specifies the affordance. Row-offer logic is `host-controls.ts` (Vitest);
the RN screen is not unit-tested per the stack, but the sheet was exercised
on-device (iPhone 17 sim against the cloud dev deployment): the away target drew
"Make host" dimmed with the away hint, confirming the disabled path; the
enabled-transfer tap was not run on device (target was away by then) but is the
identical `run()` path as Remove and `transferHost` was verified live via CLI.

**F2 — Host-initiated player removal — RESOLVED by task 3.7.** Was:
scope lists "remove players" (removal invalidates the old participant) with no
`removePlayer` mutation. Now implemented (`convex/convex/players.ts`): deletes
the target's seat so their Session Token no longer resolves (`session` returns
null; they may rejoin fresh), allowed mid-game (the beat resolves on the server
clock), with the same host gate and refusals as transfer. Covered by
`players.test.ts` › host controls; security review PASS. **Wired into the UI
(task 3.7):** the same manage sheet as F1 — "Remove" runs `removePlayer`
and stays live for an away target. Verified end-to-end on-device (iPhone 17 sim):
tapping Remove on an away player dropped their row and returned the footer to
"1 player in".

**F3 — TV disconnection — RESOLVED by Feature 6.** Repository inspection
reopened the previously presence-only behavior. The TV now owns a durable
session token, heartbeats every three seconds, marks the room away after 13
seconds, cancels the active deadline, stores the exact remaining time, and
returns a state-free paused projection. A returning heartbeat restores the same
room and beat; ten minutes of silence deletes the room, players, and TV-session
row. Malformed runtimes remain unavailable rather than being resumed blindly.

**Resolved — player cap.** Scope now says 10, matching `ROOM_PLAYER_CAP`
(reconciled in the 5.7 branch).

**F4 — Empty-room lifecycle — RESOLVED by product direction.** The TV session
owns the production room. `players.leaveRoom` clears Host, browsing and active
game after the final departure, cancels the game deadline, and preserves the
same room/code as an empty lobby. The next joiner becomes Host. TV silence and
`expireTvRoom` remain the only production deletion clock, so closing the TV app
still collects the room after its recovery window. Covered in `players.test.ts`.

**F5 — Player/Host disconnect pause — RESOLVED.** A confirmed in-game silence
sets durable `playerPaused`, cancels the active deadline, and stores its exact
remainder. Game input and scheduled deadlines are inert. If the disconnected
seat was Host, succession runs first; the successor receives the same explicit
Wait/Continue UI. Wait is passive and auto-resumes when every remaining seat is
present; `games.continueAfterDisconnect` is Host-authorized and re-arms the
exact remainder. Overlapping TV/player loss preserves one remainder and gives
TV loss display precedence. Covered in `games.test.ts`, `tv-recovery.test.ts`,
and the Controller/TV running projections.

**F6 — Below-minimum active game — RESOLVED by product direction.** A game's
declared player range is a start gate only. After disconnect, the Host may
continue with any remaining connected count; away seats stay recoverable and
reducers receive their identities. The exact-remainder Continue test uses a
two-player game after one disconnect, proving active continuation at one player.

## Manual checks to run per release

The rows marked 🧪 have no repo automation and are the documented release
matrix. Historical device evidence exists from 5.3, but no physical Android TV
or mixed phone hardware was available during the 2026-08-11 reconciliation;
re-run the complete matrix before release:

1. iOS phone + Android phone + Android TV in one room, both games played.
2. QR scanned by each phone OS camera opens the join deep link.
3. Host participates while managing the room; host leaves and transfer lands
   (automatic — see F1). Host opens a non-Host roster row's manage sheet and
   both **Make host** (manual transfer) and **Remove** land, with transfer
   dimmed on an away row (F1/F2, task 3.7).
4. Player and Host background/lock/switch apps mid-game: verify pause, Host
   succession, Wait auto-recovery, and Continue below minimum.
5. Late join during each game; TV app relaunch/recovery within the window.
6. Back-to-back games including a Trivia↔Voting switch.
7. Cold-launch both apps and confirm the static Huddle splash hands off without
   a blank/default frame to the animated in-app startup surface; repeat while
   restoring a phone session and recovering a TV room.
