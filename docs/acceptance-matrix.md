# MVP Acceptance Matrix

> **Task 5.4 — the multiplayer acceptance matrix across both games.**
> Every approved MVP workflow (`docs/project-scope.md`) mapped to at least one
> passing check, with the **second game (Voting) included** alongside Trivia.

## Method

- **Automated** rows cite a passing test suite by file and, where it helps,
  `describe`/`it`. The whole suite is `pnpm test` — **69 files, 782 tests, 0
  failures** in the current Feature 6 verification run (the historical Phase 5
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
  only with Trivia; `convex/convex/voting-lifecycle.test.ts` (19 tests, added
  here) now runs the same platform workflows with `gameId: 'voting'`. That file
  is this matrix's "second game included" backbone.
- **Manual** rows are workflows that need real hardware — two phone OSes, a
  physical Android TV, a phone camera scanning a QR — that no automated suite in
  this repo can stand in for. They cite the documented device runs from 5.3
  (see git history) and are re-confirmed per release.
- **Gap** rows are approved scope with no implementation to check. They are
  listed in **Findings** below and are input to 5.6, not silently passed.

Legend: ✅ automated · 🔁 game-agnostic (proven once) · 🧪 manual · ⛔ gap

---

## Room lifecycle

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| TV launch creates a room with a 4-char code | 🔁 | 🔁 | `rooms.test.ts` › createRoom; codes unique, redraw-on-collision |
| Room persists across games; ending returns to the same room | ✅ | ✅ | `games.test.ts` › ending (roster/host/code intact); `voting-lifecycle.test.ts` › "returns the room to its lobby with roster, host and code intact" |
| Switching games returns to the room, no state carried | ✅ | ✅ | `voting-lifecycle.test.ts` › "switches between the two games, carrying nothing across" (Voting→Trivia→Voting) |
| Empty room stays open while TV holds; next joiner hosts | 🔁 | 🔁 | `players.test.ts` › host ("leaves the room with an away host when nobody is there to take it"); `rooms.test.ts` › unjoined-room window |
| Room closes when its recovery/expiry window lapses; state discarded | 🔁 | 🔁 | `rooms.test.ts` › room expiry ("deleted once the window passes", "gives its Room Code back to the pool") |

## Joining and identity

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Join by 4-char code | 🔁 | 🔁 | `players.test.ts` › joinRoom; `apps/controller/src/join-entry.test.ts` |
| Join by scanning the TV QR (phone OS camera → deep link) | 🧪 | 🧪 | Manual (5.3 device runs); QR payload built in `apps/tv` + `packages/game-core/src/join-link.test.ts` |
| Choose display name + built-in avatar/color before joining | 🔁 | 🔁 | `apps/controller/src/color-picker.test.ts`, `color-rejection.test.ts`; `players.test.ts` › claimColor |
| Session Token issued and stored in SecureStore; validated server-side | 🔁 | 🔁 | `players.test.ts` › session; `apps/controller/src/session.test.ts`; `packages/game-core/src/session-token.test.ts` |
| Simultaneous joins seat one host, no lost seats | 🔁 | 🔁 | `players.test.ts` › "joinRoom under simultaneous joins", "hands one host to a room a dozen phones join at once" |
| Room code locates a room but is never authorization | 🔁 | 🔁 | `games.test.ts`/`players.test.ts` — every mutation gates on the Session Token, not the code |
| iOS **and** Android controllers with an Android TV | 🧪 | 🧪 | Manual (5.3 device runs); one automated logic layer serves both OSes (tech-stack: RN client logic in `apps/*/src`) |

## Players and capacity

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Up to 10 players in a room (`ROOM_PLAYER_CAP`) | 🔁 | 🔁 | `players.test.ts` › joinRoom (roomFull at the cap); `packages/game-core/src/room-capacity.ts` = 10 |
| Each game declares its own player range; start gated on it | ✅ | ✅ | Trivia 2–10 `games.test.ts` › "refuses a party smaller than the game is playable by"; Voting 2–10 `voting-lifecycle.test.ts` › "refuses a party below Voting's declared minimum" |

## Host controls

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Browse / select / configure a game from the phone | ✅ | ✅ | `game-registry` carousel/registry/logic suites; `apps/controller/src/settings-choice.test.ts`, `host.test.ts` |
| Start a game; non-host start refused | ✅ | ✅ | `games.test.ts` + `voting-lifecycle.test.ts` › "refuses a phone that is not the Host" |
| Settings locked at start (re-start refused mid-game) | ✅ | ✅ | `games.test.ts`/`voting-lifecycle.test.ts` › "refuses to start a second game over the one being played" (`alreadyInGame`) |
| End the active game; discard state, keep room | ✅ | ✅ | `games.test.ts`/`voting-lifecycle.test.ts` › ending |
| Leave the room / room closes when the last player goes | 🔁 | 🔁 | `players.test.ts` › `leaveRoom` ("closes the room when the last player walks out", "frees the Room Code the moment the room closes") |
| Host is also a normal player; can act in the game | ✅ | ✅ | `games.test.ts` › "is open to every player, not only the Host"; Voting votes from the host seat in `voting-lifecycle.test.ts` |
| Host cannot read another player's private state | ✅ | 🔁 | Trivia: `games.test.ts`/`players.test.ts` private-projection; Voting has **no** private per-player state — the tally is anonymous (`voting-lifecycle.test.ts` › "keeps the tally anonymous") |
| **Manually transfer host status** | 🔁 | 🔁 | `players.test.ts` › host controls › transferHost + `host-controls.test.ts` (row offers, away-target disable) — task 3.7, see Findings F1. Host Roster manage sheet wired; sheet + away-disabled transfer verified on-device (iPhone 17 sim) |
| **Remove a player** | 🔁 | 🔁 | `players.test.ts` › host controls › removePlayer + `host-controls.test.ts` — task 3.7, see Findings F2. Host Roster manage sheet wired; **Remove verified end-to-end on-device** (iPhone 17 sim: seat dropped, footer returned to "1 player in") |

## Game selection and configuration

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Catalog + metadata (name, art, range, duration, modes) | ✅ | ✅ | `game-registry` browsing/carousel suites; both modules' metadata in `packages/games/*/src/logic.ts` |
| TV mirrors the host's selection/configuration | 🔁 | 🔁 | `games.test.ts` › browsing query; `apps/tv/src/carousel-footer.test.ts` |
| Settings settled against the game's own schema (validate/default) | ✅ | ✅ | Trivia (3 settings) `games.test.ts`; Voting (1 setting) `voting-lifecycle.test.ts` › "starts on the rounds the Host chose…", "refuses a value…", "refuses a setting…" |
| A game the build does not install is refused | 🔁 | 🔁 | `games.test.ts` › "refuses a game the Registry does not install" |

## Playing a game

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Player event reaches the module; room keeps the result | ✅ | ✅ | `games.test.ts` › event suite; `voting-lifecycle.test.ts` › "carries the vote to the module…" |
| Event attributed by Session Token, never by the phone's claim | ✅ | ✅ | Both suites › "names the {player,voter} from the Session Token, never from the phone" |
| Private input stays private; only shared state on the TV | ✅ | ✅ | Trivia private answers `answering.test.ts`; Voting privacy is **structural** — `voting-lifecycle.test.ts` asserts the payload holds no voter→choice map |
| Simultaneous inputs without races | ✅ | 🔁 | Trivia `games.test.ts` › "takes a whole party answering at once"; same transaction path serves Voting votes |
| Authoritative timers; clients render countdowns locally | ✅ | ✅ | Trivia question clock `games.test.ts` › "the clock a question runs on"; Voting **both** beats server-clocked `voting-lifecycle.test.ts` › "the room's own clock, driving both of Voting's beats" |
| A whole game plays out to a finish | ✅ | ✅ | Trivia `playToTheFinalScores`; Voting › "plays a whole game to finished on its own clock, with no phone awake" |
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
| A game never waits for an away player | ✅ | ✅ | Trivia `games.test.ts` › "the away players it names"; Voting `voting-lifecycle.test.ts` › "reveals past an away player" |
| Reconnect with the valid credential restores the same participant | 🔁 | 🔁 | `players.test.ts` › presence/session ("brings a player back the moment their phone beats again"); `apps/controller/src/presence.test.ts` |
| Host disconnect → longest-connected eligible player becomes host | 🔁 | 🔁 | `players.test.ts` › host transfer ("hands the room to the longest-connected active player", "moves the room inside the fifteen seconds a host may be gone for", "passes over players who have gone quiet") |
| Below-minimum after a departure: game cannot continue | 🔁 | 🔁 | Enforced at start for both (`refusalToStart`); mid-game below-minimum is the host's wait/end decision (see Findings F2 for the missing removal control) |
| TV disconnect → room pauses, preserves its exact beat, then closes after the recovery window | ✅ | ✅ | `convex/tv-recovery.test.ts` and `rooms.test.ts`: durable TV heartbeat, 13-second away transition, exact remainder, paused gameplay gate, and ten-minute expiry |
| Back-to-back games, including switching between the two | ✅ | ✅ | `voting-lifecycle.test.ts` › "switches between the two games…", "replays Voting from a clean state" |

## Persistence and scope boundaries

| Workflow (scope) | Trivia | Voting | Evidence |
|---|---|---|---|
| Room/game state ephemeral; discarded when the room closes | 🔁 | 🔁 | `rooms.test.ts` › `expireRoom` deletes room + players |
| No score carried between games | ✅ | ✅ | `games.test.ts` › "leaves its scores behind"; `voting-lifecycle.test.ts` › switching carries nothing across |
| Only convenience prefs (last name/avatar) may persist locally | n/a | n/a | Optional per scope; not yet implemented (tracked in 5.8) |

---

## Findings (historical baseline; Feature 6 resolutions below)

**F1 — Manual host transfer — RESOLVED by task 3.7 (backend).** Was: scope
lists "manually transfer host status" but only automatic `handOverRoom` existed.
Now implemented as the host-authorized `transferHost` mutation
(`convex/convex/players.ts`): hands the room to a chosen **connected** player,
refuses a non-host caller / stale token / out-of-room target / the host's own
seat / an away target. Covered by `players.test.ts` › host controls; independent
security review PASS. **Wired into the UI (task 3.7):** the Host Roster's manage
sheet (`apps/controller/src/app/controller-screen.tsx`) — a non-Host row opens a Soft Minimal
confirm dialog whose "Make host" runs `transferHost`, dimmed for an away target;
`docs/design/legacy/boardwalk-handoff.md` §5 now specifies the affordance. Row-offer logic is `host-controls.ts` (Vitest);
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
(task 3.7):** the same manage sheet as F1 — "Remove" (punch) runs `removePlayer`
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

## Manual checks to run per release

The rows marked 🧪 have no repo automation and are the documented manual matrix,
last exercised in 5.3 (real-device verification, see git history). Re-run before
release:

1. iOS phone + Android phone + Android TV in one room, both games played.
2. QR scanned by each phone OS camera opens the join deep link.
3. Host participates while managing the room; host leaves and transfer lands
   (automatic — see F1). Host opens a non-Host roster row's manage sheet and
   both **Make host** (manual transfer) and **Remove** land, with transfer
   dimmed on an away row (F1/F2, task 3.7).
4. Player backgrounds/locks/switches apps mid-game and reconnects.
5. Late join during each game; TV app relaunch/recovery within the window.
6. Back-to-back games including a Trivia↔Voting switch.
