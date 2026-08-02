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
  (docs/design/design-handoff.md is the spec); no hex value outside it. The
  one exception is each app's Expo config, which needs a window
  `backgroundColor` before any React view exists and cannot import the token
  (Expo transpiles `app.config.ts` and then `require`s it, so an imported
  `.ts` is never transpiled). Those literals are allowed only where they equal
  a Boardwalk value, and `color-literals.test.ts` enforces both that and their
  agreement with the token each app's root screen paints.

## Definition of Done
A task is done when its acceptance criteria pass as tests (unit/integration per
tech-stack.md; device-visible criteria verified manually on dev builds). A
phase is done when its slice works end-to-end and is tested.

## Pinned Defaults
4-letter room codes, minted from A–Z without I and accepted as any of A–Z
(the tvOS blank-tile mitigation below; codes minted before it still hold an
I) · 10-player cap (per-game property; trivia: 2–10) ·
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
  never references huddle.tv. Rendered on the tvOS simulator and matches the
  handoff: tilted sticker tiles with a colour per letter, the orange badge, the
  QR card, and the footer. Whether it reads right on a real 10-foot panel is
  still open — see Phase 5's design fidelity pass and real-device builds.
- [x] Joining a room: server rules & TV roster (split from "Phone join by
  code", which bundled six criteria across the backend, the controller UI and
  the TV) — AC: `joinRoom` adds a player to a room by code and the TV roster
  shows the nickname within 1s; a nonexistent code is rejected "room not
  found"; a nickname already taken in that room is rejected "name taken"; an
  11th player is rejected "room full"; each rule has an integration test, and
  the cap and duplicate checks hold against simultaneous joins rather than
  only sequential ones. The roster has since been watched on the tvOS
  simulator: a join seated "Grace" and the footer went to "1 of 10 joined"
  with no reload, so the live subscription is real rather than argued. "Within
  1s" is still not *measured* — the observation was a screenshot taken after
  the fact, not a timed one, and convex-test has no websocket to time it in.
  Likewise
  the simultaneous-join tests exercise concurrent dispatch, not parallel
  commit, because convex-test serializes mutations; the rest rests on Convex's
  OCC plus a read set that was inspected.
- [x] Phone join screen (the other half of the split) — AC: join screen per
  handoff (code tiles auto-advance per letter, name input); entering code +
  nickname adds the player and shows the "You're in" screen; all four server
  rejections (`roomNotFound`, `roomFull`, `nameTaken`, `nameUnusable`)
  surface as the handoff's error copy, chosen by `kind` rather than by
  matching on message text.
- [x] Phone join by QR — AC: scanning the TV's QR opens the join screen with
  the code prefilled; only the nickname remains to type. The phone's own camera
  opens the link, so the Controller asks for no camera permission of its own.
  Verified on the iOS simulator by opening `huddle://join/XZBY`: iOS offered
  the app, and the join screen came up with the code already in its tiles and
  only the name left to type. A camera scanning the TV's QR is the one step
  still untried, and it waits on Phase 5's real-device builds — everything
  after the scan is the same deep link, exercised here.

## Phase 2 — A room that survives a party
Goal: identity, Host, disconnects, and expiry behave like scope demands;
demoable by force-quitting apps mid-lobby.
- [x] Session token rejoin — AC: player force-quits and reopens the app → back
  in the room as the same player (same player row, same nickname); the roster
  never shows a duplicate.

  Rejoin is a *read*, not a join: a returning phone presents its Session Token
  and asks which seat is already its own, which is structurally why the roster
  cannot grow a duplicate. `joinRoom` mints the token, the `session` query
  resolves it to a seat, and the `roster` projection keeps it off the TV.

  Tests and types only — the observable half of the AC has not been seen. A
  force-quit demo needs the dev deployment's `players` table cleared (it holds
  Phase-1 rows minted before `sessionToken` existed, and the push aborts on
  them — written up in `docs/tech-stack.md`), then a schema push and a
  Controller dev build. The 4-second patience before the join screen gives up
  waiting on an unreachable backend is reasoned from round trips, not measured
  on a phone.

  Two consequences accepted rather than solved. A player can still take a
  second seat if the backend is unreachable for the full 4 seconds *and* they
  deliberately retype a different nickname — retyping their own name hits
  `nameTaken` while their first row still holds it. And joining room B while
  seated in room A orphans A's row, holding one of its ten seats until presence
  and room expiry clean it up. Both are written up in `resumeSession`'s
  docstring.
- [x] Presence & away badge — AC: phone backgrounded ≥10s → TV roster marks
  that player "away" within a further 5s; foregrounding clears it within 5s;
  active players show the green status dot per the handoff.

  Two constants carry the AC, derived rather than picked: a 3s heartbeat and a
  13s away threshold. A phone goes quiet *between* beats, so the room acts no
  earlier than 13 − 3 = 10s (never premature) and no later than 13s, leaving 2s
  of the AC's 15 for the scheduler and the push to the TV. Both bounds are
  pinned against the scope's literal seconds, and review confirmed by mutation
  that they fail if either drifts.

  Away is a *scheduled write*, not a comparison made at read time: a Convex
  query re-runs when its rows change, not when time passes, so a roster
  deriving away-ness from a timestamp would show a full room of present players
  until somebody joined. Exactly one check is pending per present player —
  "away" is precisely "no check pending" — and that is now asserted against
  `_scheduled_functions` rather than only documented. The beat is keyed on the
  Session Token, not the `playerId` the roster hands out, so no client can hold
  another player present; there is no API path by which one client learns
  another's token.

  The away *visual* is a judgement call, not the handoff's: it specifies no
  away state for a TV seat, and an "AWAY" pill at the 18px TV minimum would
  overhang a 72px seat. The avatar dims to `opacity.unavailable`, the dot mutes,
  and the nickname goes to `colors.mutedText` rather than dimming — ink at 30%
  over the screen colour measures ~1.8:1, unreadable across a room. A real pill
  belongs with the §3 lobby cards when they land.

  Verified against `convex-test` on a fake clock, and the schema is now pushed
  to the dev deployment — but the real scheduler's punctuality, which the 2s of
  slack exists for, is still reasoned rather than measured.
- [x] Host role & auto-transfer — AC: first player to join is flagged Host
  (HOST pill on TV card and roster row) and their phone shows host controls;
  Host disconnects → the longest-connected active player becomes Host within
  15s; original host rejoins → they are a regular player.

  The Host is a pointer on the room (`hostPlayerId`), not a flag on a player, so
  "exactly one host" is structural rather than maintained. It moves inside
  `markAway`: a host who has gone quiet is a host who has left, since the room
  cannot tell those apart, and riding the away check is what makes the handover
  punctual — the plan's 15s are the 10–13s `AWAY_AFTER_MS` already spends, with
  the rest left for the scheduler. The successor is the earliest-joined player
  the room is still hearing from, measured off `lastSeenAt` rather than the
  `away` flag: with a whole party putting phones down at once, every check comes
  due together, and the flag would hand the room to a player the room was about
  to give up on. A room with nobody beating keeps its away host — being away is
  not resigning, and a hostless room can never be started.

  Both surfaces the AC names are later screens: the HOST pill belongs to the §3
  TV lobby card and the §5 phone roster row, and the host controls it describes
  (pick game, settings, start) are Phase 3 tasks. So the role is drawn on the
  surfaces that exist — the phone's "You're in" screen gets the real pill and is
  told the room is theirs, everyone else is told whose it is by name (the
  handoff's §4 copy, which needed the host to be knowable); the TV's 72px
  pairing seat says it in the palette's own Host avatar tangerine, because a
  pill wide enough to read across a room does not fit it, the same measurement
  that kept the away badge off that seat. That tangerine started as the circle's
  fill and moved to its offset shadow in the colored-seats task below: the fill
  became the player's claimed color, and `tangerine` is itself one of the ten a
  player can claim, so a Host wearing it as a fill would have been
  indistinguishable from whoever claimed it — the shadow, offset onto the
  screen's cream, is the one channel none of the ten fills collide with. The
  HOST pill still waits on the §3 lobby card either way. There is nothing yet
  for a host to press.

  Every client learns the host from the `roster` projection, which is why a
  handover reaches the new host's phone as a push rather than at its next
  launch. Verified against `convex-test` on a fake clock.
  Color claim was split into the three below during implementation: it bundled a
  palette, a server rule and two screens, and each of those is a piece that can
  be reviewed and reverted on its own. The acceptance criteria are unchanged,
  only divided.
- [x] Player palette & claiming a color — AC: `packages/ui` extends the
  Boardwalk accents to 10 distinct player colors, each legible as an avatar
  fill under Bungee initials; a `claimColor` mutation records a player's choice;
  two players in a room cannot hold the same color, and the rule holds under
  simultaneous claims; the claimed color reaches every client on the `roster`
  projection.

  The palette is split across two packages on purpose: game-core holds the ten
  *names*, because which swatch was tapped is protocol both sides share, and
  `packages/ui` holds what each one looks like, because that is the only place a
  color may be written down. `packages/ui` keys its palette off game-core's list
  so there is one list, and gained a dependency on game-core to do it.

  Both palette promises are held to arithmetic rather than to the eye: every
  pair is ≥12 ΔE apart (CIE76), and every color carries the ink its monogram is
  set in — one text color cannot serve ten fills, since ink on cobalt measures
  2.8:1 and white on yellow 1.4:1. The floor is WCAG's 3:1 for large text, which
  is what 24–42px Bungee is; the worst pair in fact measures 4.2:1. `punch` and
  `plum` are the reason the floor is not 4.5 — neither clears it against any
  monogram, and dropping two Boardwalk accents to satisfy a threshold written
  for body text would have been the wrong trade.

  `claimColor` enforces one color per room the way `joinRoom` enforces one
  nickname — read-then-write inside a serializable transaction, so five phones
  racing for green produce one green. Verified against `convex-test`, including
  a contested run where ten players claim all ten colors at once.
- [x] The color picker on "You're in" — AC: the seated screen shows the 10
  swatches (44px circles, selected one carrying ink border + shadow); tapping
  one claims it; colors another player holds render at 30% opacity and cannot
  be taken; the player's own avatar takes the color they claimed.

  Ten 44px circles wrap into two rows of five: a single row runs 500px before
  any gap, on a screen that is 390. What is dimmed comes from the `roster`
  subscription rather than from anything the phone remembers, so a swatch
  claimed across the room goes unavailable here without this phone touching
  anything — and the picker dims exactly what `claimColor` would refuse, since
  both read the same answer. The refusal is still shown when two thumbs land
  inside a round trip, which is the only one a player should ever meet.

  The swatches carry no press state. Boardwalk has one "dimmed" treatment and
  the picker already spends it on *somebody else holds this*, so dipping a free
  swatch under a thumb would say the opposite of what is happening. The feedback
  is the claim itself: the swatch takes the ink border and shadow the moment it
  is the player's.
- [x] Colored seats and "JUST JOINED!" on the TV — AC: a seat's circle is its
  player's claimed color with Bungee initials; a newly joined player's seat
  carries the pink "JUST JOINED!" treatment for ~4s. The handoff draws both on
  the §3 lobby card, which does not exist yet — as with the HOST pill, they land
  on the pairing seat that does, and move to the card when it arrives.

  The pink is the accent Offset Shadow the handoff's signature rules already
  give that card (`8px 8px 0 #E23D6D`), not a pill: a pill wide enough to read
  across a room still does not fit a 72px seat. The Host's tangerine moved onto
  the same channel, because the circle's fill now says who a player *is* — see
  the host task above.

  Seen on the tvOS simulator, with players seated through `npx convex run`
  against the cloud dev deployment: Ada's circle drew cobalt with a white "A"
  and Grace Hopper's punch with an ink "GH", so the palette's paired monogram
  inks are on screen and not merely in a unit test; the tangerine Host shadow
  followed a real auto-transfer when Ada's heartbeat stopped; an away player's
  seat still dimmed, shadow with circle. The four seconds are *measured*: four
  screenshots 1.1s apart caught a joining player's pink shadow at roughly +1.2s,
  +2.3s and +3.4s after the push, settled by +4.4s.

  What that pass is carrying is the settle itself. `JUST_JOINED_MS` is pinned to
  4000 by a unit test and the arrivals fold is tested hard, but the timer in
  `useJustJoined` is a React hook with no test around it — a literal `400` in
  its place would leave the suite green. So the "~4s" rests on inspection plus
  the simulator run above, and would not survive a careless edit.
- [x] TV room-open resilience — AC: a TV that launches before the backend is
  reachable recovers on its own, with no human touching the remote (the TV app
  is defined as untouched after launch); `openRoom` already clears its memo on
  failure, so this is a caller that retries with backoff, plus a visible
  "reconnecting" state; a missing `EXPO_PUBLIC_CONVEX_URL` surfaces as that
  same readable failure rather than throwing at module import, which currently
  crashes the app at launch.

  The crux was that a room fails to open in two different shapes, and they want
  opposite treatment. A *rejection* is an attempt that is over, so it earns a
  retry: 1s, 2s, 4s, 8s, 16s, then every 30s forever, with no attempt limit —
  a television has no remote to press, so giving up is giving up permanently.
  *Silence* is an attempt still out there: `ConvexReactClient` queues a mutation
  it has no socket for and neither resolves nor rejects it, which is exactly
  what a TV switched on ahead of its router gets. So after 4s of patience the
  screen says so and nothing further is issued — re-asking would open a second
  room the instant the socket came up, and every phone that had read the first
  code off the screen would be typing it at a room nobody was showing.
  `openRoom`'s in-flight memo is what makes waiting safe.

  The handoff draws no failure state for this screen. Rather than invent one,
  the caption slot under the code tiles becomes a Boardwalk status chip in
  trouble — chip accent, ink border, offset shadow through `StickerSurface`,
  pill radius, a 2° tilt leaning against the badge above it, at 22px against
  the 18px TV floor. It is assembled from parts the system already had; the one
  addition is `stickerTilt.statusChip`.

  Seen on the tvOS simulator, all three states: an unreachable deployment draws
  the reconnecting chip with no crash; an empty `EXPO_PUBLIC_CONVEX_URL` draws
  the misconfigured chip — the case that used to kill the app at launch; a real
  deployment opens the room and draws the QR. Review separately confirmed the
  crash is gone rather than moved (the app's one `useQuery` is unreachable
  without a client) and that no sequence of failures reaches a double-open: a
  20× remount storm held peak concurrency of the underlying mutation at 1.

  Argued, not observed: the recovery *transition* itself — backend absent at
  launch, then present, room appears untouched. Staging it honestly needs a
  backend started mid-run or the Mac's network toggled, so it rests on the unit
  tests plus Convex's own socket retry. The 4s patience and the 30s ceiling are
  reasoned from round trips, not measured on a television. The Controller's
  client still throws at import on a missing URL; that was left deliberately —
  this task names the TV, and a phone has someone holding it — but it is the
  obvious matching task if the symmetry is wanted.
- [x] Room expiry — AC: last player disconnects → after 10 minutes with no
  rejoin, the room and its players are deleted (integration test with mocked
  clock); the TV returns to a fresh pairing screen.

  "The last player disconnects" is not something a room can observe, so it is
  defined as the room being *deserted*: every player Away. The check rides
  `markAway`, since that is the only place a player becomes away and therefore
  the only way a room can become deserted. It asks the `away` flag where the
  Host handover deliberately asks `lastSeenAt`, and the reasons are opposites: a
  host has to move at the *first* check that comes due, so it cannot wait on
  flags that lag, while expiry must happen at the *last* one, and the flag is
  what makes that exact. A whole party putting phones down together brings every
  away check due at once; against the clock each of them would schedule its own
  deletion for the one room, and against the flags only the last one to run sees
  a room where everybody is away. One party, one pending deletion.

  The ten minutes run from the last heartbeat the room *heard*, not from the
  moment it noticed — the room has already spent `AWAY_AFTER_MS` of the party's
  absence working out that they were gone, and that is not the party's time to
  lose. `roomSilence` reads it off the newest `lastSeenAt` among the players, so
  the room needs no expiry field of its own.

  Nothing is cancelled when somebody comes back, as nothing cancels an away
  check. Cancelling would mean writing to the room row on a heartbeat, and a
  heartbeat is ten phones every three seconds against the one row a whole party
  shares — contention bought for nothing. `expireRoom` re-reads the clock when it
  runs instead, and leaves a room that has been rejoined standing; the phone that
  returned will go quiet again, and `markAway` starts the ten minutes over then.

  A room nobody has ever joined never expires *by this clock*: nobody left it,
  and its Room Code is on a television somebody may be reading across the room,
  so taking it away is the one thing expiry must not do. The consequence is that
  never-joined rooms accumulate — the dev deployment holds about twenty-five from
  past TV launches — which is flagged rather than fixed here, because every fix
  for it is a fix that can delete a code off a working screen. (Superseded on
  2026-08-02 by Phase 5's "A room nobody joins is never deleted" task, which
  gives that room a second, much longer clock of its own rather than putting it
  on this one. This clock is unchanged.)

  **Seen, on the real scheduler.** The tvOS simulator against the cloud dev
  deployment: the TV opened `DKZS`, a player joined and took a seat, and the
  deployment held exactly one pending `rooms.js:expireRoom` for that room,
  scheduled at the join plus 600.0s. It fired on time — room gone, `players`
  table empty, `stillOpen` false — and the television, untouched, drew `BVNR`
  with a fresh QR and "0 of 10 joined". The replacement room row was created
  208 ms after the expiry's scheduled time, so "the TV returns to a fresh pairing
  screen" is measured rather than argued.

  What that run does not carry: the rejoin-saves-the-room path and the
  multi-player desertion arithmetic are `convex-test` on a fake clock only, and
  `useRoomExpiry`/`useRoomOpening` are React hooks with no test around them. The
  reopen logic under them is tested through `roomOpener` — including the
  double-report guard that would otherwise mint a second room — but the wiring
  from the subscription to that logic rests on the single run above.

  One cost measured and accepted: because nothing is cancelled, a player who goes
  away and comes back repeatedly leaves a pending `expireRoom` behind each time.
  Twenty away/return cycles leave twenty pending jobs, each of which fires and
  does nothing; the worst realistic case is roughly forty-five pending checks
  against one room in a ten-minute window, each costing one room read and at most
  ten player reads. That is benign at ten rooms, and the alternative is the
  room-row write on every heartbeat that the design exists to avoid.

  A Controller gap this exposes, left for the phase that owns the phone's room
  screens: the Controller resolves its session once at launch, so a phone left on
  "You're in" when its room expires goes on showing a dead Room Code until it is
  relaunched — at which point `players.session` answers nothing and it lands
  correctly on the Join Screen.

## Phase 3 — Trivia, minimal loop: the platform is born
Goal: a complete playable trivia game with flat scoring on a small inline
question set — and the game-module interface exists because trivia is behind
it.
- [x] Game-module interface in `game-core` — AC: interface exposes metadata
  (id, title, key-art treatment, player range, est. duration, category),
  settings schema, initial-state factory, `reduce(state, event)`, and TV/phone
  screen components; the hub renders purely from the registry (trivia is the
  only entry); a compile-time test instantiates a dummy module against the
  interface.

  `GameModule<State, Event, Settings>` holds all three of a game's own types,
  and the hub holds all three opaquely. The members that touch them are
  declared as *methods* rather than properties, which makes their assignment
  bivariant — the deliberate hole that lets a `GameModule<TriviaState, …>` sit
  in a `readonly GameModule[]`. It is a hole, and it is the only way one array
  holds games of unrelated shapes; what the hub does through it is store and
  reload a state it never reads.

  The Registry is its own package, `@huddle/game-registry`, because the
  dependencies point the wrong way for it to live in game-core: every module
  depends on the interface, so the list of modules cannot sit beside it without
  a cycle — and the TV, the Controller and the Convex mutations all read it, so
  it belongs to none of them either.

  Two decisions the plan did not settle. A Settings Schema is a *declaration*
  the hub renders — labelled options with a default — not a Zod schema, because
  a validator carries neither labels nor the order to draw them in; Zod keeps
  the pack format and the function boundary. And every Game Event names its
  player (`GameEvent`), so one generic mutation can carry any game's event —
  but the name is a claim, filled in server-side from the Session Token, never
  believed from the phone.

  **The compile-time test bites, checked rather than assumed.** A Coin Toss
  module built against the interface — state, event and settings deliberately
  unlike trivia's — plus five `@ts-expect-error` cases. Mutating the interface
  five ways (optional `estimatedMinutes`, dropping the `Event extends
  GameEvent` constraint, widening `reduce`'s return to `unknown`, widening the
  key-art color to `string`, widening the TV screen's state to `any`) each
  turned a case into `TS2578: Unused '@ts-expect-error' directive`. Two of
  those were re-run independently at review; the files restored byte-identical.

  What this does not carry: the AC's "hub renders purely from the registry" is
  true structurally — the registry is the only place in Huddle that names a
  game, grep-verified across `apps/` and `convex/` — but no hub surface draws a
  game yet, so the *rendering* half is only demonstrated by the carousel task
  below. Trivia's entry is metadata and an honest zero: an empty settings
  schema, a `reduce` that returns the state it was given, and screens that draw
  nothing, each commented with the task that fills it. Its `estimatedMinutes`
  is 5 rather than the handoff's "~12 min" chip: ten questions at a 20s
  countdown and a 5s reveal is about five minutes, and sooner when everybody
  has answered. The handoff mock is not filler — the "2–10 players" beside it
  is trivia's real range — so the contradiction was resolved in the handoff
  itself (§6), which now records that the carousel draws whatever
  `GameMetadata` declares and that the mock's number is the chip's shape rather
  than trivia's duration.
- [x] Room phase & the game lifecycle mutations (server half of "Room state
  machine & game lifecycle", split because the original bundled three AC
  clauses across `convex/`, `game-core` and both apps) — AC: a room's phase is
  `lobby → in-game → lobby`, stored on the room with the running game's id and
  its state; `startGame` is Host-only, refuses a game the Registry does not
  install and a room already in a game, and seeds the state from the module's
  initial-state factory; `endGame` is Host-only and returns the room to the
  lobby with its roster, host and Room Code intact; integration tests cover
  both, the refusals, and that a non-Host cannot call either.

  The phase is not a column. A room holding a game is in a game and a room
  holding none is in its lobby, so `rooms.game` — `{ gameId, state }`, optional
  — is the whole of it, and `roomPhase` reads the phase off it. A stored phase
  beside a stored game would be one fact written twice, with an in-game room
  holding nothing as the row that says so; this way that row cannot be spelled.
  It also makes each transition a single patch, so neither can half-succeed.
  `state` is `v.any()`, because it belongs to the game: the hub stores and
  returns it without reading it, which is what keeps a second game out of the
  schema.

  **The module had to be split, and that changed the task above.** `reduce` and
  `createInitialState` run server-side, so Convex must import the Registry —
  but a module's screens are *properties* of it, and properties do not
  tree-shake, so importing whole modules would have put React Native in the
  server bundle two tasks before trivia's screens exist. `GameLogic` (metadata,
  settings schema, factory, reducer) is now the half the server reads and
  `GameModule extends GameLogic` adds the screens; trivia and the Registry each
  ship both through separate entry points, and the two lists are the same
  objects rather than copies (asserted by identity, not equality).

  **Checked rather than argued:** bundling `convex/games.ts` with esbuild puts
  `triviaGameLogic` and `GAME_LOGIC_REGISTRY` in the output and leaves
  `screens` and `triviaGameModule` out of it entirely — the `exports` seam is
  honoured, not hoped for. That is esbuild run directly, which is the tool
  Convex bundles with but not Convex's own pipeline, so it is a proxy for the
  real build and not the real build.

  Ending is unconditional where starting is refusable, and the two rules are
  kept in different functions because of it: `phaseAfter(intent)` is the total
  `lobby → in-game → lobby` machine, and `refusalToStart(phase, seated, range)`
  is the whole of what can stop a start. A second tap on "End game" asks for the
  lobby the room is already in and there is nothing to tell the person holding
  the phone; a second *start* would throw away the state of a game in progress,
  so `alreadyInGame` refuses it, and a party below `playerRange.min` gets
  `notEnoughPlayers` carrying both numbers — the only useful thing to say is how
  many more people have to join. The Host check runs before the Registry lookup,
  so a phone with no room control learns only that it is not the Host and never
  whether the game it named exists.

  A room too *large* for a game is deliberately not refused. The room cap is ten
  and no installed game may declare a maximum above it, so the rule could not
  fire today; and were a smaller game installed tomorrow, refusing at the tap
  would strand a party, since Huddle has no way to remove a player. It belongs
  in the Host's picker, which can decline to offer a game the room has outgrown
  while there is still something the Host can do about it.

  What this does not carry: nothing renders any of it yet — both clients still
  draw their lobbies, which is the task below. The player count is every seat in
  the room, Away ones included; excluding them is Phase 4's "Away players
  in-game", and doing it here would have been building ahead of it.
- [x] TV and phones follow the room into the game (client half of the split) —
  AC: Host selects trivia and starts → TV and all phones switch to trivia
  screens within 1s; Host "End game" mid-game → everyone returns to the lobby,
  room intact; both clients mount the module's screens out of the Registry
  without naming a game.

  One function decides it on both clients. `runningGameScreen(running)` turns
  the room's answer into one of three: the lobby, this module on this state, or
  a game this build does not install. Neither client names a game — grep for
  "trivia" across `apps/` and `convex/` finds one comment and no code — and the
  Host's start control offers the Registry's entry by its metadata title, so the
  carousel task replaces what is browsed rather than this control.

  The in-flight moment counts as the lobby, deliberately: every client is
  already on its lobby when it asks, so `undefined` draws what is on screen
  instead of flashing something else on the way to it.

  **Unknown Game is a real state, not a defensive branch.** A phone that has not
  been updated can walk into a room whose TV has, and the reverse. Folding it
  into the lobby would put a Room Code on a television for a room that is
  mid-game, and invite a player to act on one — so both clients say the app is
  behind instead.

  Two subscriptions had to outlive the switch, and both were placed for it. The
  phone's heartbeat sits above the screen's early returns, so a player mid-game
  is still present and does not go Away while answering; the TV's `stillOpen`
  moved up into `OpenRoomStage`, because a room that expires during a game still
  has to send that television back to a fresh Room Code, and the subscription
  would have unmounted with the lobby. `OpenRoomFooter` is gone, its work now
  done a level up.

  What this does not carry — and it is the AC's own headline. "Within 1s" is
  **argued, not observed**: it rests on the same Convex subscription the roster
  uses, which *has* been seen pushing a join to a television within a round
  trip, but nothing here has been run on a simulator or a television. Trivia's
  screens still draw nothing, so an in-game TV today is the game's title over an
  empty Boardwalk canvas and an in-game phone is its title and, for the Host,
  "End game" — the switch is visible, the game is not. Settling the timing
  honestly needs the TV and a phone against the cloud dev deployment, watching
  the Host's tap land on both.

  Also untested by construction: every component added here is React, and this
  repo tests logic rather than rendering. `runningGameScreen` and `startControl`
  carry the decisions and are unit-tested; the wiring from a subscription to a
  mounted screen rests on the typecheck and on the run that has not happened.
- [x] Synced game carousel — AC: host phone prev/next (or swipe) updates
  `browsingGameIndex` in room state; the TV carousel follows within 250ms
  (focused card treatment per handoff); non-host phones show "Now viewing
  <Game>"; renders correctly with the registry's single MVP entry.

  An index into the ordered Registry, not a game id: browsing is a walk along a
  list, so "the third card" has to mean the same thing on the television and on
  the phone, and ids would leave the two to agree an order separately. It is
  clamped rather than refused — the list differs between builds, and a phone
  that browsed past what this deployment installs should get the nearest card,
  not an error on a television. `browseGame` is Host-only for the reason the
  rest of the lifecycle is: one shared surface that anybody could move is a
  surface nobody can read.

  **A decision the docs did not settle, and the user made:** §1 pairing, §3
  lobby and §6 carousel are three separate TV screens, and at handoff sizes they
  cannot coexist — the focused card alone is 520px of a 720px stage, so the
  carousel and the Phase 2 roster cannot both be on screen. The television now
  shows the pairing screen while the room is empty and the carousel from the
  first join onward, with the Room Code moving to the header chip that §3 and §6
  both keep. The cost is that the filling-up seats stop being the TV's main
  event once anybody is in.

  With one game installed both side cards are absent rather than duplicated, and
  both arrows are dead — a list of one that wrapped would give the Host two
  buttons that changed nothing. Two Boardwalk tokens were added for §6 rather
  than inlined: `opacity.carouselSideCard` (50%, deliberately not the 30%
  `unavailable`, because a neighbouring game is not unavailable) and
  `stickerTilt.carouselSideCard`.

  **A regression this task caused and caught.** Putting `browsingIndex` on the
  server's entry point as a re-export from `./carousel` pulled `GAME_REGISTRY`
  — and every installed game's React Native screens — straight back into the
  Convex bundle, undoing the seam two tasks earlier existed to build. Nothing
  failed; the bundle simply grew the screens back, and it was found only by
  re-running the esbuild check by hand. The clamp now lives in `./browsing`,
  which takes a list *length* and imports no Registry at all, and
  `logic.test.ts` walks the server entry point's import graph so the same
  mistake fails a test instead of a play-test. That guard was mutation-checked:
  re-adding the offending export fails both its assertions.

  What this does not carry: "within 250ms" is **argued, not observed**, exactly
  as the previous task's "within 1s" is — same Convex subscription, nothing run
  on a television. The guard is a *source* check and not a bundle check: it
  reads relative imports inside `packages/game-registry` and would not see a
  bundler inlining something from outside it. And the handoff's swipe (§7,
  "Swipe or tap arrows") is not implemented — the arrows are, the hint text
  promises both, and with one installed game there is nothing to swipe to.
- [x] Trivia reducer with flat scoring — AC (unit tests, using a 3-question
  inline set): each question presents 4 options with exactly 1 correct; a
  correct answer scores +100, wrong or no answer +0; with players A and B
  where A answers 3/3 correctly and B answers 1/3, final scores are A=300,
  B=100; after the last reveal the game emits a finished state ordered A, B.

  What this does not carry: any seated phone can end the beat for the whole
  room. `advanced` discards the event's playerId, and a game module is
  deliberately never told who the Host is, so authority over `advance` is the
  hub's problem and is not solved here.

  The question list, `correctIndex` included, rides in `game.state`, which the
  public `running` query in `convex/convex/games.ts` hands to every phone
  before the reveal. It leaks nothing today, because the phones bundle
  `INLINE_QUESTIONS` themselves — but Phase 4's server-side packs would be
  leaked by that same line, and the pack is rewritten into the room document on
  every answer event.

  Two things the screen tasks below need from here: the reveal does not move to
  the next question by itself, and a sender of `advance` must read the state it
  is looking at in order to address the event — the beat it is ending, not
  "now".
- [x] Phone answer screen — AC: 4 large buttons matching the TV's option
  colors/shapes; tapping locks the answer (buttons disable, "locked in"
  shown); a second tap changes nothing; answering before the question is
  shown is impossible.

  What this does not carry: **"matching the TV's option colors/shapes" is not
  verified, because there is no TV question screen yet** — it is the next task.
  What was built instead of a match is a shared source: both screens take an
  option's color from `accentFace(optionIndex)` in `packages/ui`, so they agree
  by construction rather than by two files being kept in step. The TV task is
  where that stops being an argument.

  The screen itself is untested, per the repo's rule that renderers are not
  tested (docs/tech-stack.md). What *is* tested is everything behind it:
  `answering.test.ts` covers which buttons a state offers — including that a
  locked-in player has no pressable option left and that a phone on any other
  beat is offered nothing at all — and `logic.test.ts` and `games.test.ts`
  cover the refusals underneath. So "buttons disable" and "'locked in' shown"
  are argued from the code, not observed. Nothing here has run on a phone.

  This task also carried two things the plan did not anticipate, both forced by
  it being the first real screen: `boardwalkFonts` moved out of `@huddle/ui`'s
  root barrel to `@huddle/ui/fonts` (a barrel is all-or-nothing, so importing
  `colors` was dragging four .ttf files into every Node test), and Vitest now
  stubs `react-native`. See docs/tech-stack.md, including what the stub can
  hide.

  The event transport landed here rather than in the reducer task: `sendEvent`
  in `convex/convex/games.ts` is the one mutation a running game's events
  travel on. It names the player from the Session Token and never from the
  phone, stores nothing when the module makes nothing of the event, and skips
  the write when the rules refuse — so a refused tap wakes no subscription.
- [x] TV question & reveal screens — AC: TV shows question, 4 options, and how
  many players have answered ("3/5 answered"); when all active players have
  answered, reveal shows the correct option and per-player correctness; then
  the running scoreboard for 5s; then the next question.

  How "then the next question" happens, since the plan did not say: the
  television cannot send it. A TV screen is given the room's state and its
  roster and nothing else — it holds no player record, and every Game Event
  must name a player. So the Reveal Beat comes from the phones, and from
  *every* playing phone rather than a nominated one: the `advance` is addressed
  to the beat it ends, so the first to arrive moves the room and the rest do
  nothing. One nominated phone would be one phone whose screen locking stalls
  the room. This is the flat cost of the reducer task's flagged gap, paid the
  cheap way; Phase 4's question timer is where a server-side scheduler and a
  player-less event belong.

  What this does not carry: **the reveal and the running scoreboard are shown
  together for the 5s, not in sequence.** The AC reads "reveal shows the correct
  option and per-player correctness; then the running scoreboard for 5s", and
  everything named is on screen for the full five seconds. This matches
  docs/CONTEXT.md's Reveal, which is one phase showing the answer "followed by
  the running scoreboard" — recorded here so a later reader does not re-litigate
  it. A sequenced version needs no reducer change, only a second timer inside
  the reveal render.

  **A room with every phone backgrounded at once stalls on the reveal.** Nothing
  else can send the beat. It self-heals the moment any phone comes forward, and
  the Host's "Back to lobby" is the only other way out. Phase 4's server-side
  scheduler is the real fix.

  **One line of the send path is guarded by nothing.** `revealBeat` decides what
  to send and when, and is asserted against four mutations — but the line in
  `useRevealBeat` that actually calls `sendEvent` when the timer fires is in a
  `.tsx` file, and deleting it would hang every reveal with tests, lint and
  typecheck all green. Closing it means mounting a React component, which the
  repo has no renderer for and deliberately does not do (docs/tech-stack.md).
  A play-test is what catches this one.

  Also true of the two screens generally: neither has run on a television or a
  phone. The Boardwalk ink borders on both were wrong until review caught it —
  every `StickerSurface` needs an explicit `borderColor`, since the surface
  paints its band from that field — which is the kind of thing only a screen
  someone has looked at can settle.
  Victory & return to lobby was split into the two below during
  implementation: it bundled a television screen with a hub mutation and a
  Host control on the phone, which are separate layers that can be reviewed
  and reverted on their own. The acceptance criteria are unchanged, only
  divided.
- [x] Victory Screen — AC: after the last question the TV shows final
  standings (winner celebrated, ties share the top rank).

  Who won is decided in `watching.ts` and not on the screen, for the reason the
  standings' order already was: it is one answer to "who won", and a renderer
  working it out is a renderer that can disagree with the next one to draw it.
  So the ranks, who counts as a winner, and the Headline's words are all
  asserted in `watching.test.ts` — single winner, two-way tie, a whole room that
  scored nothing tying ten ways, and a player whose phone left mid-game.

  The Headline is the decision the AC did not settle: "winner celebrated" does
  not say what a screen says when four people tie. It says "It's a tie!" rather
  than naming them, because ten seats can tie any number of ways and the list
  would be a paragraph rather than a celebration. Recorded in docs/CONTEXT.md so
  the next screen needing end-of-game copy finds it.

  Every winner is drawn at the same size as everyone else, the celebration
  riding Boardwalk's accent offset shadow instead — a card per winner would run
  a ten-way tie off the stage.

  What this does not carry: **the screen has not run on a television.** Review
  drove the real component through a played-out game with a throwaway probe and
  read the text it renders, which is how "ties share the top rank" was checked
  against the screen rather than only the data behind it — but that probe is
  deleted and is not a test, and the repo does not test renderers
  (docs/tech-stack.md). **A full ten-seat room likely overflows the 720px
  stage** at five rows of placings, as the reveal's verdicts already do at that
  size; the comment in `tv-screen.tsx` says so rather than claiming a fit. Both
  are play-test questions.
- [x] Back to lobby — AC: the Host's "Back to lobby" returns everyone to the
  lobby with the same roster.

  Most of this was already standing: `endGame` has been Host-only and
  unconditional since the hub phase, and the roster survives structurally
  rather than by care — `players` holds nickname, color, away and token, and
  every score lives in `rooms.game.state`, so returning to the lobby drops the
  scoreboard because there is nowhere else it could have been. What this task
  added is the phone's control saying the true thing, and tests that hold the
  AC's own words instead of trusting that arrangement.

  "The same roster" is now pinned by a test that claims colors before playing
  the game out, which the pre-existing one did not: review checked by patching
  `endGame` to clear every color on its way out, and only the new test went
  red. Host-only was checked the same way, by swapping the Host lookup for the
  ordinary one.

  Available on every beat, not only after the Victory Screen — the prior task
  left a room whose phones all backgrounded stalling on the reveal with this as
  its only way out, so a control that waited for a finish would not reach the
  case it exists for. That also settles the copy: the hub never reads game
  state, so the label has to be true on all beats, and "End game" is false on
  the beat after a game has ended.

  It also closed a dead end it was not asked to: a Host whose build lacks the
  room's game was told they would rejoin when everyone returned to the lobby —
  waiting on themselves, with nothing in the room able to move it. The Unknown
  Game card now carries the control for the Host. The §3 lobby card stays
  deferred.

  What this does not carry: **nothing has run on a phone.** That the control
  renders at all, and only for the Host, is a `.tsx` condition and untested by
  the repo's rule — the server refusal underneath it is what is actually
  guarded. The button keeps the punch face, which is right for discarding a
  game in progress and arguably alarming on the Victory Screen where the action
  is benign, and there is no confirmation on a mid-game return. Both are
  play-test questions rather than rules anyone has decided.

## Phase 4 — Full trivia: packs, timers, settings
Goal: trivia as scoped — curated pack, countdowns, host-tunable settings —
ready for a real game night.
- [x] Question-pack format & curated pack — AC: Zod schema for pack (id,
  title, version, questions[text, 4 options, correctIndex, category,
  difficulty]); a malformed pack fails `pnpm validate:packs` and CI; the
  shipped curated pack passes and contains ≥100 questions across ≥4
  categories.
- [x] Question timer — AC: each question runs a 20s countdown shown on the TV;
  players who haven't answered when it expires score +0 for that question;
  reveal triggers at expiry or when all active players have answered,
  whichever comes first (integration test with mocked scheduler).
- [x] Settings schema & a game started from it (server half of the split) —
  AC: trivia declares settings {scoring: flat|speed (default flat),
  questionCount: 5|10|20 (default 10), category: all|<pack categories>
  (default all)}; the schema is generic in `game-core`, not trivia-shaped;
  `startGame` refuses settings that the declaring game's schema rejects, and
  defaults anything absent; a started game uses exactly the chosen settings,
  drawing from the curated pack — category "Movies" yields only Movies
  questions, count 5 yields exactly 5. This is the task that first wires
  `@huddle/packs` into trivia in place of its `INLINE_QUESTIONS`.
- [x] Lobby settings UI (the other half of the split) — AC: the Host phone
  renders the settings controls generically from whatever schema the chosen
  game declares — nothing in the renderer names trivia or any of its
  settings; a non-Host phone never sees settings controls; changing a
  control updates what the room will start with, and every phone's carousel
  keeps working while the Host is choosing.
- [x] Speed scoring mode — AC (unit tests): correct answer scores
  `100 + round(100 × secondsRemaining / 20)`; e.g. correct with 15s left
  = 175, correct at 0s left = 100, wrong at any time = 0; flat mode unchanged
  at 100.
- [x] Away players in-game — AC: an away player is excluded from "3/5
  answered" denominators; their scoreboard row shows the away badge; a player
  who returns mid-question may answer that question if its timer is still
  running.

## Phase 5 — Party-ready
Goal: the app matches the Boardwalk design on real hardware; a full game night
runs without touching a dev tool.
- [x] A Room Code tile sometimes draws empty on tvOS — AC: reproduce a blank
  tile deliberately, then prove the fix by an A/B of the identical crop rather
  than by one screenshot that looks right.

  **Found and fixed on 2026-07-31. Read this block first: everything below it is
  the trail that led here, and every line of it saying the mechanism is unknown
  is superseded by this one.**

  **The mechanism, and it is not really about the letter I.** React Native
  measures an *empty* `<Text>` by substituting a placeholder string, and the
  placeholder is the single character **"I"** —
  `ensurePlaceholderIfEmpty_DO_NOT_USE` in ReactCommon's
  `attributedstring/PlaceholderAttributedString.h`. `TextLayoutManager::measure`
  (`textlayoutmanager/platform/ios/.../TextLayoutManager.mm`) measures that
  placeholder, zeroes the width of the result because the real string was empty,
  and then stores the zeroed result in the measure cache **under the
  placeholder's own key** — the attributed string (its text and the attributes
  that affect layout), the paragraph attributes, and the layout constraints. So
  every empty tile files "this text reads I and is 0pt wide" in the cache, and an
  I arriving afterwards under those same three gets a cache hit on it, lays out
  0pt wide, and paints nothing. Every earlier
  observation falls straight out of that: only I; only when the letter was not in
  the first committed render (nothing else files the poisoned entry); surviving a
  remount, since the cache belongs to the layout manager rather than to any node;
  and shipping in Release.

  Measured rather than argued. With `onLayout` and `onTextLayout` on the tile
  letters, a blank tile reports a *view* box of `0.00 × 96.00` while its own text
  line reports `53.24 / 96.00`: the glyph was laid out, and the box it had to
  live in was zero. A character sweep on the same after-mount path then separates
  the string from the glyph — `"I"` blanks, while `"i"` (36.50pt, the same width
  as the failing `"I"` at that size), `"1"`, `"l"`, `"."`, `"II"`, `"AI"`, `"IA"`
  and `"I "` all draw. It is the string "I", exactly and alone, because that is
  the placeholder and not because it is a letter.

  **The fix** is `codeLetterBox` (`packages/ui/src/code-tile.ts`), spread into
  the TV tile's letter style: `alignSelf: 'stretch'` with `textAlign: 'center'`,
  so a letter's box is its tile's and never its glyph's. A measured width that
  comes back wrong then decides nothing. It is deliberately *not* the "render the
  tiles only once the code is known" gate the previous note pointed at: that gate
  would have paid for correctness with the no-reflow decision, and it would only
  hold for as long as nothing else on the surface files a poisoned "I". The
  comment about drawing the tiles before the code arrives therefore stands
  unchanged, and is now explained rather than merely asserted.

  **The A/B the AC asks for.** `tools/blank-tile-repro.patch` is the
  deterministic repro as a patch (pinned `RIJI`, delivered after mount);
  `tools/blank-tile-watch.py --keep LABEL` saves the *same* fixed crop of the
  tile row on every launch. Same instrument, same repro, same rectangle, eight
  launches either side of the one-line change:

  | | tile 0 `R` | tile 1 `I` | tile 2 `J` | tile 3 `I` |
  |---|---|---|---|---|
  | before, 900ms delivery (4 runs) | 17.45% | **4.88%** | 13.68% | **5.49%** |
  | before, 60ms delivery (4 runs) | 17.45% | **4.88%** | 13.68% | **5.49%** |
  | after, 900ms delivery (4 runs) | 17.45% | 13.68% | 13.68% | 14.32% |
  | after, 60ms delivery (4 runs) | 17.45% | 13.68% | 13.68% | 14.32% |

  The crops themselves are committed at `tools/blank-tile-ab/`, so the A/B is
  readable by anyone without a tvOS simulator; the tool's own output directory
  stays ignored.

  8/8 blank before, 0/8 after, at both delivery timings — the same 8/8 and 6/6
  the repro used to give. An empty tile keeps only its border, which is the
  ~5% reading; the I's ink is the ~14%. That `R` and `J` hold to the same two
  numbers across all sixteen runs is the other half of the check: the fix moved
  nothing that was already drawing. Three further launches on the real product
  path (server-dealt code, `BOAD` among them) drew all four.

  **It did not cost the reflow the old comment was protecting.** The tiles are
  still drawn empty before the code arrives, so there is nothing to reflow, and
  the instrument now checks that rather than trusting it: on every run where a
  pre-code frame was caught it reports `row held` — the four tile boxes are at
  identical pixel coordinates before the code lands and after.

  **Still open, and narrowly.** The fault is React Native's, not Huddle's, and
  it is fixed here only where it was seen: any other `<Text>` in either app that
  goes from empty to exactly "I" in the same metrics and constraints would blank
  the same way. The Controller's Join Screen cells render *no* `<Text>` at all
  while a cell is empty, so they never file the poisoned entry — read off
  `apps/controller/app/index.tsx`, not observed on a phone. They carry
  `codeLetterBox` anyway, so the rule holds wherever a Room Code letter is drawn
  rather than in one app by design and the other by accident; that it draws the
  same pixels is measured on the TV (the `R` and `J` tiles hold their ink to
  0.01% across all sixteen A/B runs) and inferred on the phone, whose cells are
  the same construction with room to spare — a 58px content box for a glyph that
  is at most ~31px at that size. The Controller is not installed on a simulator
  here and was not rebuilt for it. Nothing was reported upstream. A code minted before PR #8 was not resurrected to watch it draw
  (nothing can mint an I any more), but such a code is exactly the pinned repro:
  an I-holding code delivered after mount, which now draws 8/8. Whether the
  minting alphabet should take I back now that the tile is fixed is a separate
  decision and was deliberately left alone.

  **A mitigation landed on 2026-07-31 (superseded above — it is no longer the
  only thing standing between a room and a blank tile).** `ROOM_CODE_ALPHABET`
  was dropped to A–Z without I and renamed
  `ROOM_CODE_MINT_ALPHABET` (`packages/game-core/src/room-code.ts`), so no
  newly minted code can contain the failing glyph. What it does *not* buy: the
  rendering fault is untouched and its mechanism still unknown, so a code
  minted before the change still holds an I and its tile still blanks, and the
  next letter to hit the same fault would not be caught by this. It is a
  narrower alphabet, not a fix, and the A/B the AC asks for is still owed by
  whoever finds the mechanism. (All of that was true when it was written and
  the last two sentences are now spent: the mechanism is at the top of this
  task, an I delivered after mount draws, and there is no "next letter" — the
  fault was never about the alphabet, only ever about the one string React
  Native measures empty text with.)

  Reading a code stayed at the full A–Z (`ROOM_CODE_ACCEPTED_ALPHABET`, which
  is what the join screen's `codeEntry` filters by) on purpose: rooms minted
  before the change are live and on a television, and a phone that swallowed
  the I they can see would turn a rendering mitigation into a room nobody can
  join. `joinRoom`'s `normalizeRoomCode` never checked an alphabet and still
  does not.

  **It now reproduces on demand, and the "letter I" reading is back — read
  this before the 2026-07-30 account below, which the warning at the top of
  this task used to contradict.**

  On 2026-07-31, 28 instrumented cold launches on the tvOS simulator against
  the cloud dev deployment, real product path, random server-dealt codes:

  | | code contains an I | no I |
  |---|---|---|
  | a tile blanked | **5** | 0 |
  | every tile drew | 0 | **23** |

  The five were `SHIN` (pos 2), `IQYV` (pos 0), `IJUN` (pos 0), `IEAN` (pos 0)
  and `QIYB` (pos 1) — five positions across two accent runs, and in every one
  the blank tile is exactly where the I is. No tile holding any other letter
  has ever blanked, in 28 launches or in any earlier session.

  **How this squares with the disproof.** The earlier experiment — a bare `I`
  in all four tiles drawing correctly on five consecutive launches — disproves
  "I *always* blanks". It does not touch "*only* I blanks", which is what every
  observation before and since is consistent with, including this plan's own
  note that the clean eleven-launch run "happened to contain no I". The two
  readings were conflated and the task was warned off the live hypothesis. The
  honest statement is: **the failure is specific to the letter I and is not
  deterministic** — a hardcoded I has drawn fine, while a server-dealt I has
  now failed 5 times out of 5.

  **The instrument.** Cold launch, wait for a *stable* frame, then measure ink
  coverage inside each of the four tile cards: a drawn glyph covers ~16%, an
  empty card keeps only its ~3% border. Calibrated against a real frame and a
  synthetically blanked copy so it is known to fire. Two traps it must handle,
  both of which produced false positives first time round: a dev build takes
  longer than 9s to fetch its bundle, and a frame where *all four* tiles are
  empty is the room code not having arrived yet — the QR card is empty in
  those frames too — not four holes.

  **It is not dev-only — it ships.** A Release build (`expo run:ios
  --configuration Release`, embedded bundle, no Metro) drew room `RJBI` as
  `R J B _` on its first launch, QR fully drawn so the code had arrived. So
  this reaches users, and a blank tile makes the room unjoinable from the
  television. That removes the "wait and see whether it only happens in dev"
  option and makes a mitigation urgent even ahead of the mechanism.

  **It reproduces deterministically, and the axis is not the one anyone
  guessed.** Pin a code containing an I in `RoomCodeTiles` and vary only *when*
  it arrives:

  | how the code reaches the tiles | blank |
  |---|---|
  | present at the component's first render | **0 / 8** |
  | delivered after mount by a 900ms timer | **8 / 8** |
  | delivered after mount by a 60ms timer | **6 / 6** |

  So it is not timing, not the font, not the colour, not the position, and not
  the letter alone: **an I that is not in the first committed render does not
  paint.** Every other letter survives the same path — all 23 non-I codes in
  the launch runs were server-delivered and drew.

  This also explains the 2026-07-30 contradiction that sent this task wrong:
  the hardcoded experiments that passed had the letter present at first render,
  and the ones that failed did not.

  **Fixes tried and disproven, so nobody pays for them twice** — each re-run
  against the deterministic repro, all still 8/8 blank:
  - `key` on the `<Text>` so a changed letter mounts a fresh node;
  - `key` on the whole `StickerSurface` so the entire tile subtree remounts.

  That a *freshly mounted* text view still blanks is the sharp part: this is
  not React reusing a node, so the fault is below it, in native text layout on
  a non-initial pass. The next thing to try is rendering the tiles only once
  the code is known (letter present in the first commit), which the current
  "draw empty tiles so the screen does not reflow" comment deliberately rules
  out — that decision is now in tension with a correctness bug and should be
  revisited first.

  Next: the mechanism is still unknown, so a fix still cannot be chosen. Of the
  two escape routes previously ruled out for chasing a disproven cause, the
  first — dropping I from the minting alphabet — was taken on 2026-07-31 and is
  recorded at the top of this task; it buys time rather than correctness. The
  second, setting the tiles in another face, is untried and remains available.
  The unexplored lead on the fault itself is rendering the tiles only once the
  code is known, so the letter is present in the first commit, which the
  current "draw empty tiles so the screen does not reflow" comment deliberately
  rules out. (Superseded: the mechanism was found the same day and is at the
  top of this task. The lead was sound about *why* — the letter has to miss the
  poisoned cache entry — and was not taken, because taking the letter's width
  from its tile fixes it without spending the reflow decision. Setting the
  tiles in another face would never have worked: the face is not the variable.)

  Seen three times on the tvOS simulator on 2026-07-30, the first time the
  pairing screen had been run since the Boardwalk work: room code `OVAI` drew
  as `O V A _`. Rendering a fixed `AIHI` then blanked both I's across two
  positions and two accent colors, and `IJLT` drew J, L and T and dropped only
  the I, while the live code `MMBH` drew all four tiles. That looked conclusive
  and it is what the first version of this task claimed.

  **It does not survive retesting.** Later the same session, a bare `I` in all
  four tiles drew correctly on five consecutive fresh launches, as did `I`
  followed by a zero-width space, `I` followed by a space, and `HI`. So the
  glyph is not the variable and the letter-specific reading is disproven —
  which also matches "TRIVIA" having rendered its own I's correctly on the
  television throughout the failing runs. Whatever this is, it is intermittent
  and something other than the character decides it.

  Ruled out with evidence, so nobody pays for it twice: the font
  (`Bungee_400Regular.ttf` has I at glyph 39, one contour, advance 605, bbox
  (53,0)-(551,720) — the same shape of record as J and L); GSUB's `vert`
  feature (it covers 375 glyphs including A and H, which never failed, and its
  target for I is a normal 74-byte glyph); `codeLetterColor`; tile position;
  and a font-loading race at the layout, since `apps/tv/app/_layout.tsx` already
  holds the first frame until `useFonts` resolves.

  Worth noting about the failing runs, as the only pattern left: all three were
  in the first minutes of a session, two of them after a fast refresh, and one
  on the first render after the session's first cold Metro bundle.

  **A deliberate reproduction attempt failed.** Eleven cold launches over two
  methods on 2026-07-30: five with the letter hardcoded, and six on the real
  product path — Metro cache cleared, the code arriving from the server after
  mount, screenshotting the first render — which is as close to the original
  conditions as the setup gets. Every tile drew. The codes were random and
  happened to contain no I (`APME`, `XCBV`, `HMBS`, `SFHT`, `NJGG`, `RSGG`),
  so that run tested "any blank tile" rather than the I specifically.

  Two mechanisms were considered and do not survive the evidence: a truncated
  or half-loaded font asset (it would blank a contiguous run of glyph ids, but
  A/H at 2/37 drew while I at 39 did not, and J/L/T at 40/43/51 drew), and a
  `Text` whose content changes after mount (the `AIHI` and `IJLT` runs were
  hardcoded at mount and still failed).

  So the next person should not start from a theory. Start by catching it: it
  has only ever appeared in the first minutes of a session, so the cheapest
  instrument is a screenshot on every launch for a while, kept until one comes
  back with a hole in it.

  It is not cosmetic — the Room Code is the only way a phone joins, and a blank
  tile makes the room unjoinable from the television. But a fix cannot be
  chosen until it reproduces on demand, and the two escape routes floated
  earlier (dropping I from `ROOM_CODE_ALPHABET`, or setting the tiles in
  another face) would both change a documented decision to chase a cause that
  has now been disproven. (Superseded: the cause was re-established on
  2026-07-31 and the first route was taken — see the top of this task. The
  constant is now `ROOM_CODE_MINT_ALPHABET`.)
Split on 2026-07-31: "Design fidelity pass" bundled four independent
acceptance criteria across eight hub screens, the trivia screens, typography
and two animations — one checkbox that could not be reviewed or committed as
one thing. The four below are the same AC, in the order a screen has to
satisfy them. Nothing was added or dropped.

- [x] Design fidelity — hub screens against the mock — AC: the hub screens
  (pairing, join, lobby ×3, carousel ×3) are spot-checked side-by-side against
  the Boardwalk mock in `docs/design/design-handoff.md`, on a simulator, with
  the discrepancies either fixed or written down as deliberate departures and
  why. A screen that was drawn from the handoff but never *compared* with it
  counts as unchecked.

  Compared on 2026-07-31, on the Apple TV 4K (3rd generation) and iPhone 17
  simulators against the cloud dev deployment. The frames are committed at
  `tools/design-fidelity/`, with the device, build and scale in its README, so
  the comparison is re-readable without a simulator. **Six of the eight screens
  were driven by a real client** — the TV app opened its own rooms, and the
  Controller typed its way through §2, §4, §5, §7 and §8 on the phone; the
  players who had to already be in the room (a Host for a player's-eye §4/§8,
  a second seat to enable the start control) were **seeded** with
  `players:joinRoom` from the CLI. The §3 TV lobby and the §5 phone roster could
  not be driven or seeded, for the reason below: they are not built.

  **What was compared.** Every measurement the handoff writes down for these
  eight sections — sizes, weights, colors, spacing, borders, radii, shadow
  depths, tilts and copy — read off the rendered frame where it is a pixel and
  off the `StyleSheet.create` block where it is plainly in the source. The
  pairing screen and the join screen come back clean at that standard: the
  96px gap between the code group and the QR card, the 148×176 tiles on a 166px
  pitch, the 196px QR inside its 252px card, the 72px dashed seats, the 64×80
  phone cells on a 76px pitch, and the accent order cobalt/tangerine/punch/green
  all measure what the handoff asks for.

  **Fixed, and each traceable to a line of the handoff.**
  - §7's primary button was `colors.green`; the handoff says "Primary cobalt
    button". The override is gone and the button is the same cobalt as §2's
    Join, which is what makes them one control in two places. (The label is
    still "Start <Game>" rather than the handoff's "Select <Game>" — see the
    departures.)
  - §7's selected-game block was a title and a position and nothing else; the
    handoff's is "title + meta". It now carries the meta, from
    `browsedGameMeta` — the same three facts the §6 chips draw, read off
    `GameMetadata` so the phone and the television describe one game the same
    way, and a new game teaches both by declaring its own metadata. Only the
    *facts* are shared, though: the phrasing around them (`<min>–<max>
    players`, `~<n> min`) is spelled out in `game-controls.ts` and again in the
    TV's chips, so *rewording* the summary is still two edits. Extracting the
    phrasing was out of scope for a fidelity pass.
  - §8's "Now viewing <Game>" was a bare bold line. The handoff draws it as a
    status card with the green dot, under a caption ("Your phone becomes the
    controller the moment the game starts") that was missing altogether. Both
    are now there, on the same Boardwalk surface the lobby's own status card
    uses.

  **Written down as departures, with the reason.**
  - **§3 TV — Lobby does not exist**, and this is the largest single gap
    between the mock and the product. It is the decision the user made in the
    synced-carousel task above — the focused card is 520px of a 720px stage, so
    the carousel and a roster of 216×264 player cards cannot share a screen —
    and the television therefore goes pairing → carousel at the first join. Two
    consequences are worth naming here rather than leaving implied: the §1
    footer's *filled* seats are only ever seen for the round trip between a
    join landing and the carousel replacing the screen, so the colored seats
    and the four-second "JUST JOINED!" that Phase 2 built are on a screen a
    party barely sees; and the HOST pill, the JUST JOINED! pill and the away
    pill that three earlier tasks each deferred to "the §3 lobby card" are
    deferred to a screen that is not coming. Whether they belong on the
    carousel's footer instead is a design decision this pass did not have the
    authority to take; it is carried into the open task below rather than left
    in this one.
  - **§5 Phone — Host lobby is a section, not a screen.** The handoff's roster
    rows (40px avatar, HOST pill / online dot / pink NEW! pill), its "Your room"
    heading, its "<n> players in — you can start anytime" footer and its
    "Choose a game →" button are all absent; the Host gets §4's screen with the
    HOST pill in the header and §7's picker underneath. The picker and the start
    control landed in Phase 3 against §7, and nothing has ever built the roster.
    A phone roster is not a fidelity fix — it is a screen — so it is recorded
    here rather than smuggled into this pass, and carried into the open task
    below.
  - **§7's mini key art** is still not drawn, and the arrows still flank the
    title rather than sitting under a card. The handoff pins no size for a mini
    key art, so drawing one means inventing a measurement the mock does not
    give, which is the exact thing this task exists to catch. The meta added
    above wraps to two lines in the 178pt the middle column has between two
    76px buttons, which is the same width pressure that put the handoff's card
    *above* the arrow row; restructuring the picker that way is the change this
    departure is really deferring.
  - **§8's heading and 88px avatar.** A waiting player keeps §4's "You're in,
    <Name>!" and its 128px avatar rather than gaining "<Host> is choosing…" and
    an 88px one, because §4 and §8 are one screen here and a screen cannot have
    two headings. The result is two green-dot status cards stacked — the room's
    "Eyes on the TV — <Host> is about to pick a game" and the carousel's "Now
    viewing <Game>" — which reads acceptably and is visible in
    `07-phone-player-lobby-after.png` for anyone who disagrees.
  - **Both phone screens are vertically centred** in `PhoneScreen`, which on a
    402pt iPhone leaves the join form floating with ~200pt of canvas above it.
    The handoff gives no vertical rhythm for a phone screen, so there is no line
    to trace a change to; it is named because it is the first thing the eye
    notices in `02-phone-join-empty.png` and the next person should not have to
    re-notice it.

  **Found, measured, and left open — §6's active page dot is camouflaged by the
  focused card's shadow.** Every number below is read off `04-tv-carousel.png`
  at ×3, so it is checkable without a simulator — with one exception, marked
  where it falls: the browsing line's 28pt box is React Native's default for
  `fontSize: 22` with no explicit `lineHeight`, inferred rather than measured.
  On the 720pt stage the card's
  ink border runs y=110→630 and its 10px cobalt offset shadow to 640; the
  page-dot row runs y=628→640. They overlap by 12pt.

  *What is actually wrong.* Not occlusion — `carouselFooter` is a later sibling
  than `carousel` in `apps/tv/app/index.tsx`, so the dots paint **on top** of
  the shadow, and the frame shows it: at design y=634 the ink runs are
  x=624–627 and x=653–656 with cobalt between them, which is the dot's own
  border over the shadow. The defect is **camouflage**. The active dot is a
  cobalt pill on a cobalt shadow, so its fill vanishes into the shadow and only
  its ink border survives — the indicator reads as a hollow ink rectangle
  rather than as a filled pill.

  *The stage is over-subscribed by 14pt, not exactly full.* header (112) + card
  (520) + shadow (10) + dots (12) + gap (16) + browsing line (28) + footer (36)
  = **734**. The header is 112, not 98: the room chip's ink box measures
  y=28→84, so 56pt tall, and `carouselHeader` adds `paddingVertical: 28` either
  side. (98 is what the header would be if the *logo* set its height; the chip
  is taller, so it does not. The card's ink border starting at y=110 confirms
  112 independently.) The 14 splits 2 above the card and 12 below.

  *Where the 14pt lives — and it is not a pinned number.* All of it is header
  chrome the handoff never measures: the chip's 8pt vertical padding, its 4px
  ink borders, and a `paddingVertical` of 28 that is *already* a departure from
  §1's pinned 36. No §6 number has to give way to close this, so it is a
  fidelity fix in unpinned space, not a design decision — the earlier reading
  of this arithmetic was wrong on that point.

  *Why it is still open: the centring tax.* The card is centred in a `flex: 1`
  row spanning `[H, 628]`, so card top = H/2 + 54 and shadow bottom = H/2 +
  584. Every point freed anywhere buys half a point of clearance — which is why
  the two nudges that were tried (`paddingBottom: shadowDepth.tvHero` on the
  row, `paddingTop: shadowDepth.tvHero` on the footer) each moved the card up
  5pt and left 7pt of overlap. Zero clearance needs H ≤ 88, i.e. 24pt from the
  header: `paddingVertical` 28 → 16, which moves *further* from §1's 36 to buy
  a shadow edge that exactly touches the dots. Comfortable clearance costs 48.
  Paying 24pt of the header's breathing room for 0pt of daylight is a worse
  screen, so it was not taken.

  *The fix that does buy daylight, for whoever picks this up.* Put the dots and
  the browsing line on one row instead of stacking them — §6's "page dots +
  '<Host> is browsing on their phone'" permits it, and it costs the header
  nothing. `carouselFooter` becomes `flexDirection: 'row'` and its height goes
  92 → 64 (28 + the 36 padding), the row grows to `[112, 656]`, the card lands
  at 124→644 with its shadow to 654, and the dots sit at 664: **10pt of
  daylight**, with every pinned §6 number intact. It is two properties, not
  one: `carouselFooter` centres its children today only because it is a column
  with `alignItems: 'center'`, and `styles.screen` stretches it across the full
  1280pt — so turning it into a row hands that property the cross axis and
  packs the dots and the line against the left edge unless
  `justifyContent: 'center'` goes on with it. Every vertical number above
  survives that; only the horizontal consequence is new. And it is a
  TV edit, and this pass rebuilt no tvOS binary (see "Not carried") — shipping
  an unverified layout change to the one screen the party stares at is not
  worth saving the next person a build. It is carried into the open task below.

  *Not the fix:* recolouring the card's shadow or the active dot would kill the
  camouflage outright, since the dot paints on top. But §6 pins both — "10px
  cobalt offset shadow" and "active = cobalt pill with ink border" — so *that*
  one really would be a decision about which of the mock's numbers gives way.

  **One inaccuracy corrected in passing**: the color picker's comment claimed
  ten 44px swatches "wrap into two rows of five". They wrap 6 + 4 on an iPhone
  17 — how many fit is the phone's width, not a number the code decides — and
  the comment now says so. `04-tv-carousel.png` also shows the focused card
  drawing its title twice, once in the key art and once in the info block; that
  is what the handoff asks for (Key Art *is* a color block with its Bungee title
  on it, and §6 gives the info block its own 34px title), so it is left as
  drawn.

  **Not carried.** Nothing here was checked on a television or a phone —
  simulators only, at ×3 in both cases, so the ×1.5-for-1080p path the Android
  toolchain task measured is untested by this pass. The TV app was never
  rebuilt: every change this task made is in the Controller, and the two TV
  edits that were tried were reverted, so the tvOS binary that produced
  `01-tv-pairing.png` and `04-tv-carousel.png` is the one at HEAD. `StickerSurface`
  was not touched, so the pale-seam fix is undisturbed by construction rather
  than by re-measurement. The siblings below own what this pass did not look
  at: the three departures it could not close (next task), then trivia's
  screens, TV legibility, and the two animations.
Split on 2026-07-31, straight after the task that created it: it bundled
three criteria across both apps. (a) and (b) are both the TV carousel and
share one build and one capture; (c) is a Controller screen that has never
existed, and bundling it would have let a reviewer judge neither well.

- [x] Design fidelity — the TV carousel closes its two departures — AC: (a)
  §6's page-dot collision is fixed — the footer change is written out in the
  task above (`carouselFooter` to `flexDirection: 'row'` *plus*
  `justifyContent: 'center'`, which buys 10pt of daylight without touching a
  pinned §6 number) — and (b) the HOST pill, the JUST JOINED! pill and the
  away pill, which three earlier tasks each deferred to the §3 TV lobby that
  the synced-carousel decision means is never coming, either find a home on
  the carousel's footer or get an explicit decision, recorded against a
  handoff line, that the television stops saying these things. Both halves
  need one tvOS build and a capture beside `04-tv-carousel.png`, because this
  is the screen the party looks at and this phase has already been burned once
  by an unverified claim about it.

  Built and seen on 2026-07-31, on the Apple TV 4K (3rd generation) simulator
  against the cloud dev deployment: a Debug build of that evening's working tree
  (`expo run:ios`, Metro serving the JS), two players **seeded** with
  `players:joinRoom`, and nothing on this screen driven by a phone — the
  carousel renders `browsingGameIndex` and the roster and takes no input. The
  frames are `tools/design-fidelity/08-tv-carousel-after.png` and
  `09-tv-carousel-just-joined.png`, beside the `04` they replace, with the
  pixel columns behind every number below in that directory's README.

  **(a) The page dots are clear, and the arithmetic predicted it exactly.**
  `carouselFooter` is a centred row; the footer went 92 → 64. Measured off the
  frames at ×3: the card's ink border moved 110→630 to 124→644, its 10px cobalt
  shadow to 654, and the active dot now runs 664→676 — **10pt of screen cream**
  between them, which is the number the task above computed before the build
  existed. The camouflage is gone at the same time as the overlap: in `04` the
  dot's own column reads ink 626→630, cobalt 630→636, ink 636→639 against a
  cobalt shadow at 630→640, so its fill was the shadow's colour at the shadow's
  pixels; in `08` the same fill sits on cream. That the *indicator reads* was the
  point, not that two boxes stopped touching, and it is the frame that says so.
  One number the earlier pass inferred is now pinned rather than measured: the
  footer line's 28pt box was React Native's default for `fontSize: 22`, and
  `browsingLine` now carries `lineHeight` explicitly (`FOOTER_TEXT_LINE`, which
  the pairing footer already used), so the footer's height is a decision instead
  of a default.

  **(b) One of the three pills lands, two are dropped, and the reasons are
  different.** What made them different is a fact about this television that is
  easy to state and was not: the carousel replaces the pairing screen at the
  *first* join, so there are no seats on it at all. The question is therefore
  not "does a pill beat the seat treatment" for all three — for two of them the
  seat is not on screen and neither is anything else.

  - **The JUST JOINED! pill lands, as the footer's line rather than as a pill.**
    Its absence was a real hole, not a fidelity nit: after the first join the
    television acknowledges nobody. A party of six seats one player on a screen
    anybody watches and the other five change nothing at all, which is the
    opposite of Eyes up on the one screen the room is looking at. So §6's
    footer line is now a slot: for four seconds it belongs to the newest arrival
    ("<Nickname> just joined!", punch — Boardwalk's "join/new highlights"), then
    it goes back to "<Host> is browsing on their phone". Seen on the television
    in `09`, and *measured* there: that frame's card, shadow and dot are the
    same pixels as `08`'s, because the greeting borrows the existing 28pt line
    and adds no box. A pill was costed and refused — one runs ~46pt at the TV's
    18px minimum, which puts the footer at 82pt and the dots back inside the
    card's shadow, undoing (a). The pairing seat gave up the same pill on the
    same kind of measurement, so this is the system's answer and not this
    screen's. Timing was watched rather than reasoned: the mutation returning,
    then four consecutive captures ~1s apart — the first still muted (the push
    had not landed), the next three punch, and a fifth after the four seconds
    back to the browsing line.

    **A greeting is spent once, and the screen remembers it — found in review,
    and it is the interesting part of this bullet.** Being an Arrival is
    permanent (`just-joined.ts`: a player stays one for as long as they stay
    seated), while the four seconds were counted by the drawing component's
    *mount*. `CarouselStage` and `GameStage` are different component types at
    the same position, so ending a game unmounted one and mounted the other —
    and the television came back from ten minutes of trivia announcing
    "<Nickname> just joined!" about a phone that had landed before the game
    started. A reconnect blip reached it more cheaply still, since
    `runningGameScreen(undefined)` returns `{kind:'lobby'}` and flashes the
    carousel. That is exactly the case `just-joined.ts` already refuses for a
    seat — "a room coming back from a game has not [seen ten people walk in]
    either" — inherited from `PlayerSeat`, where it is unreachable, and put on
    screen by this task.

    So which greetings have been spent is now held by `useGreeted` in
    `OpenRoomStage`, beside the subscriptions and for the same reason: it has
    to outlive the switch to a game and back. `arrivalToGreet` is the question
    with one answer, and the spending is reported both when the four seconds
    run out *and* when a game cuts them short — a television that resumes a
    greeting after a ten-minute game is worse than one that truncates it.
    Tested rather than argued: five tests over `arrivalToGreet`, and the pair
    that pin the fix fail when the `greeted` filter is removed. Not re-observed
    on the television — the frames above predate the fix, and it changes which
    sentence is chosen rather than any box on the screen.
  - **The HOST pill is dropped from the television**, against §6's own footer
    line: "page dots + '<Host> is browsing on their phone'". The handoff draws
    the pill on a §3 lobby *card* and a §5 roster *row* — beside an avatar, which
    is the only thing a pill labels — and §6 identifies the Host in words
    instead. The state is still said twice: by name in that line (`08` shows
    "Ada is browsing on their phone"), and by the real pill on the Host's own
    phone in §4. A pill on the carousel footer would label nothing and would
    cost the same 46pt as above.

    An earlier draft of this bullet claimed a third channel — the tangerine
    offset shadow on the pairing seat — and it was wrong, in a way worth
    keeping written down because it is the same mistake §3 caused twice
    already. The carousel takes over the moment `seats.length > 0`, so
    `RosterFooter` is only ever reached with an *empty* roster: `PlayerSeat`,
    `seatHighlightShadow`, the tangerine Host shadow, the punch arrival shadow
    and `avatarAway`/`statusDotAway`/`seatNameAway` are **unreachable in any
    shipped build**. They are dead code, and the plan should stop citing them
    as live. Deleting them is not this task's business, but the next person to
    touch that footer should know they are drawing for nobody.
  - **The away pill is dropped from the television**, against the away-badge
    task's own measurement (an "AWAY" pill at 18px overhangs a 72px seat) and
    §3, which is where its only home was. The carousel has no roster, so there
    is nothing to be away *on*. The room's one away-ness that matters between
    games is the Host's, and the television reports that already by *changing
    the name in the footer line* when auto-transfer moves the role.

    **Say the consequence plainly, because it is the decision and not a
    detail: after the first join the television says nothing at all about a
    non-Host player being away.** The dimmed face and muted dot that the
    away-badge task argued for are on the pairing seats, and the pairing seats
    are unreachable once anybody is in the room (see the HOST bullet above).
    Away-ness is still visible to the party on their own phones, and the
    scoreboard's muted row and the "n/m ANSWERED" denominator still exclude an
    away player *during* a game — Phase 4 watched both. What is gone is the
    between-games case: a lobby where somebody has put their phone down looks,
    on the television, exactly like one where they have not. That is accepted
    here rather than solved, on the grounds that the footer has one line and it
    is already spent naming the Host and greeting arrivals; the phone is where
    a roster belongs, which is the §5 task directly below.

  **The row centres, so the dots move with the sentence.** Measured, not
  noticed late: the active dot's cobalt sits at x 454.3→480.3 in `08` and
  485.3→511.3 in `09`, a 31pt slide right when the greeting appears and back
  when it expires. It follows directly from the fix — a centred row re-centres
  when its widest child changes — and it is recorded rather than removed
  because the two captures above are this task's required evidence and any
  layout change would invalidate them. Whoever picks up the §5 task should
  decide whether the dots want a fixed slot; the cost is one more tvOS build
  and a third capture, not a redesign.

  **What that leaves wrong, observed rather than argued.** A room whose whole
  party has gone quiet keeps its away Host (being away is not resigning), so the
  footer goes on saying "<Host> is browsing on their phone" about a phone that
  is face-down. Seen directly at the end of this pass: `players:roster` reported
  both seeded players `away: true` with Ada still `host: true` while the
  television drew exactly that line. It is left alone deliberately — the state
  only survives when *nobody* is present (any present player takes the role
  within ~15s and the line then names them), so the sentence is only wrong in a
  room with nobody in it to read it, and the room expires ten minutes later.

  **Not carried.** Simulator only, at ×3 — no television, so the ×1.5-for-1080p
  path is still untested here. `StickerSurface` was not touched, so the pale
  seam is undisturbed by construction. The shared canvas is visible intact in
  both new frames. The sticker tilts are *not* — the only tilt this screen has
  is `stickerTilt.carouselSideCard`, and with one game in the registry the side
  cards are absent, so nothing in `08` or `09` is rotated at all. The tilt fix
  is safe because no tilt code was touched, which is an argument and not an
  observation, and this task's AC exists precisely because the phase was burned
  once by an unverified claim about this screen. The greeting is drawn from the roster
  snapshots this screen has been pushed, exactly as a seat's four seconds are,
  so a television that joins a room late greets nobody — which is the existing
  Arrival rule and not a new one. What `09` does not show is more than one game
  installed: with a single registry entry there is one page dot, so the *row* of
  dots is verified at width one and the daylight at the only width there is.
- [x] Design fidelity — §5's phone roster — AC: the Host's roster rows either
  land on the phone or §5 is marked as dropped with the reason recorded
  against the handoff. Nothing has ever built this: the Host currently gets
  §4's screen plus §7's picker. Whichever way it goes, the three pills above
  are the other half of the same question — a television that stops saying who
  is Host and who just joined puts the burden on the phone, so decide (b)
  first and let it inform this.

  **Built, on 2026-08-01, and the deciding argument is the one the task above
  left behind.** §5's rows are the only surface in Huddle that can say a
  non-Host player is away between games. The television's Seats said it until
  the carousel took their screen and the task above dropped the away treatment
  outright; §4 gives a player their own screen and §7 gives the Host a picker,
  and neither of those lists anybody. Dropping §5 as well would have left the
  product with no answer at all to "is Milo still with us?" outside a running
  game. It was weighed against the real objection — a roster the Host has to
  scroll during a party may be a screen nobody looks at — and **the first
  version of this pass answered that objection without addressing it**, which
  review caught. "A section, not a screen you navigate to" is true and beside
  the point: a section below §4's 128px hero avatar, its heading and its ten
  swatches is still a scroll, and a longer one than a screen would have been.
  Measured on the layout as first built, the first row began at **676pt** of an
  839pt viewport, so two rows landed — and in the three-player room this task's
  own frame shows, the away row was below the fold. On the one surface in the
  product that carries that news.

  **So the rows moved above the color picker**, directly under §4's heading,
  which is also where §5 itself draws them. The trade traces to what each
  section is for: a color is claimed once and never returned to, while the
  roster is what a Host re-reads all through a lobby, so the picker is the one
  that can afford to be a scroll away. Measured on the layout as it now stands
  (`11-phone-host-roster-six-players.png`, landing view, nothing scrolled): the
  label at 383.3pt, row 1 at **411.3**, a 76.0 pitch, viewport bottom 839.3.

  **What that buys and what it does not.** Rows **1 to 6** all show their
  avatar, nickname and status without a swipe; row 6 loses only its bottom edge
  and shadow. From the **seventh** player a row is entirely below the fold, and
  the count line is from the sixth. The room cap is ten, so a full party still
  keeps four rows behind a swipe — and a full party is exactly when a Host is
  most likely to be looking for the one phone that has gone quiet. That is the
  honest residue of this task and it is not solved: closing it means either a
  denser row (§5 pins the 40px avatar, the 3px border and the 16 radius, so
  what would give is padding the handoff does not pin) or saying away-ness in a
  summary the eye reaches first, which is copy §5 does not give. Neither was
  taken here, because both are design decisions rather than fidelity ones.

  **What landed.** `HostRoster` and `RosterRow` in `apps/controller/app/
  index.tsx`, with the decisions in `apps/controller/src/host-roster.ts`
  (`rosterRowSlot`, `rosterRowSpokenAs`, `rosterFooterLine`). Every measurement
  is a `packages/ui` token; the task needed no new ones, which is the reading
  that §5's row is Boardwalk's phone card at its pinned sizes and nothing new.
  The `browsingGameIndex` subscription moved up to `YoureInScreen` in the same
  edit: the roster now sits above the color picker and §7's controls below it,
  and both read that index, so one subscription answering both is what keeps
  the count line and the start control from disagreeing (see the footer line
  below). `LobbyGameControls` takes the browsed card as a prop rather than
  asking for it.

  That move widened the subscription's lifetime, which is worth writing down
  rather than discovering later: it used to open when `LobbyGameControls`
  mounted and now opens on every render path of `YoureInScreen`, so it stays
  open on a phone for the whole of a game. It is inert there — the value is
  unread in those branches, and `browsingGameIndex` cannot move while the
  picker is unmounted — so the cost is one idle subscription and no re-renders.
  It also removes a small wart: coming back through Back to lobby no longer
  shows a frame of `carouselWindow(0)` while a cold query resolves, because the
  subscription is already warm.

  **Measured off the frame, not asserted.** `tools/design-fidelity/
  10-phone-host-roster.png` at ×3, in design points: the row's ink border
  **3.00**, its offset shadow **3.00** past the bottom and right edges (the two
  read as one 6.00 ink run, which is what a Boardwalk row's edge is), the corner
  **16** (the top scanline's ink begins 15.33pt in and the edge is straight
  15.33pt down — a 16pt arc with the most-transparent pixel or two at each end
  under the threshold), the avatar **40.00** inside a 2.00pt ink ring, the
  status dot **12.00 × 12.00**, and the 10pt row gap showing 7pt of canvas
  because the shadow has the other 3. The away row is checked by *colour value*:
  its ring reads `(186,186,185)` and its face `(185,227,200)`, which are ink and
  the claimed green at exactly `opacity.unavailable` over white; its nickname
  reads `(110,102,83)` (`colors.mutedText`) and its dot `(201,191,172)`
  (`colors.mutedBorder`) against a present player's `(23,163,74)`.

  **Which was driven and which was seeded.** The Host (Ada) was **driven** on
  the iPhone 17 simulator against the cloud dev deployment, in every frame —
  Join Link opened, nickname typed, Join tapped, cobalt claimed off §4's picker.
  Everybody else was **seeded** with `players:joinRoom`. The away players are
  Milo and Zoe, because a seeded seat never beats and the room's own `markAway`
  reached them; Grace Hopper, Bea and Cyd were held present by a
  `players:heartbeat` loop from the CLI. `players:roster` was read at capture
  time and reported exactly the split the frames draw, so every muted dot is the
  room's answer and not a coincidence of rendering.

  **The four frames say which are scrolled**, which the first set did not — and
  that omission is why the layout problem above went unnoticed until review.
  `10` (three players), `11` (six) and `12` (one) are **landing views, nothing
  scrolled**; only `13` is scrolled, to the start control.

  **Three departures from §5, each with its line.**
  - **A section, not a screen.** The Host keeps §4's heading and avatar, so
    §5's "Your room" heading is a section label in the vocabulary this screen
    already labels YOUR COLOR and SETTINGS with. Same reasoning as §8 being the
    tail of §4: one screen cannot carry two headings.
  - **The pink NEW! pill is not drawn**, and this is deferred rather than
    decided against. Nothing is lost by it today — the television greets each
    arrival in punch for the same four seconds, which the task above put there
    deliberately. What it would cost is the reason: correct four seconds need
    `just-joined.ts`'s `Arrivals` fold *and* the carousel's `greeted` spending,
    both of which live in `apps/tv/src` and would have to move to a shared home
    to be reused. Re-implementing them on the phone was refused outright: the
    greeting-after-a-game bug that pass found in review is exactly what a
    second copy would re-earn.
  - **"Choose a game →" is not drawn.** The button opens §7, and §7 is already
    on this screen; the one cobalt primary button here is "Start <Game>", which
    the earlier fidelity pass made cobalt for exactly this reason.

  **The footer line drops its own invitation.** "<n> players in — you can start
  anytime" is false in a room too small for the game being browsed, so on that
  room the line is the count alone and the start control says what is missing —
  `12-phone-host-roster-one-player.png` and `13-phone-host-start-blocked.png`
  are the same one-player room, showing "1 player in" and "Trivia needs one more
  player." That is the same move §1's footer makes when it drops "waiting for
  players…", and it is why the browsed-card subscription had to move up the
  tree: whether the party can start is a question about that card, and the two
  sections that answer it now sit either side of the color picker.

  **The slot's precedence is HOST over away, and it hides nothing.** This
  roster is drawn on the Host's phone alone, so the row marked `host` is the
  reader's own, and a phone with this screen in front of its owner is one the
  room is hearing from. The case where it is not — a room whose whole party has
  gone quiet keeps its away Host — is a room with nobody in it to read the
  screen. Every row that can meaningfully be away therefore has a dot on it.
  Four tests pin the precedence, including the away-Host case.

  **What this does not close.** The fold above is the first of it. The second:
  it is **Host-only**, because §5 is — a non-Host player still learns nothing
  about anybody else's presence between games, on any surface. That is accepted
  rather than solved — §4 has no roster in the mock, and inventing one would be
  a screen this pass has no line to trace. The
  four frames are an iPhone 17 simulator at ×3; nothing here has been on a
  phone in a hand, so the 40px avatar and the 12pt dot are checked as pixels
  and not as something read at arm's length. The away state was watched
  *arriving* only in the sense that Milo was already away when the screen was
  captured — the transition from green dot to muted was not filmed, though the
  roster is the same live subscription the color picker's dimming rides and
  that has been watched pushing before. Nothing in `apps/tv` was touched, so
  the shared canvas, the sticker tilts and `StickerSurface`'s pale seam are
  undisturbed by construction; no tvOS binary was built by this task.
- [x] Design fidelity — trivia screens on theme tokens only — AC: the trivia
  screens extend Boardwalk using only theme tokens from `packages/ui` — no
  literal colors, radii, border widths, shadow depths or font families at a
  trivia call site. Enforced by something that fails rather than by reading:
  a lint rule or a test over the game module's sources.

  **A lint rule, not a test over the sources** (`boardwalk/tokens-only`, in
  `eslint-rules/`, wired into the root flat config). The question this has to
  ask is a *syntactic* one — is this value a literal or a reference? — which a
  parser answers exactly where a regex over text approximates it, and it has to
  ask it of a property's *name* rather than of any number it sees. It also
  reports on the offending line in the editor and rides `pnpm lint`, which is
  already a CI gate. The repo's existing guard, `color-literals.test.ts`, stays
  a text scan because its question is about a value ("is this hex anywhere
  outside `packages/ui`?"), which text answers perfectly. The two compose rather
  than overlap: the scan catches a hex smuggled through a name, the rule catches
  `borderRadius: 24` and `backgroundColor: 'rebeccapurple'`, which no hex scan
  can see.

  **What was found at the trivia call sites: two, and both the same one.**
  `fontWeight: '700'` on the answer buttons and on the LOCKED IN pill, beside
  `fontFamily.body`. Everything else on both screens was already on tokens.
  This one is guarded as part of "font families" and banned outright rather than
  required to be a token, because on this stack a weight *is* how a face gets
  chosen by hand and it does not work: React Native does not synthesise weights
  for custom fonts on Android, so the theme registers each weight as its own
  family (`packages/ui/src/typography.ts`) and `fontFamily.bodyBold` is the only
  way to ask for bold. Both are now `fontFamily.bodyBold`. That is a *visual*
  change on the phone — two labels that were drawing at regular weight now draw
  bold — and it has not been on a device; it is read off the token table, not
  seen.

  **Where the boundary was drawn, which is the part that decides whether the
  rule survives.** It fires only inside a style context — a `StyleSheet.create`
  block, a `style`/`…Style` prop, and `StickerSurface`'s `depth` and
  `shadowColor` — and only on property *names*: `color`/`…Color`,
  `border…Radius`, `border…Width`, `fontFamily`, `fontWeight`, `depth`. It never
  looks at a number to decide, because the handoff's own measurements are plain
  numbers all through this codebase (`width: 148`, `gap: 18`,
  `paddingHorizontal: 26`, `fontSize: 88`) and a rule that fired on those is a
  rule that gets switched off. Anchoring the width pattern on `border` is what
  keeps `width`/`minWidth`/`maxWidth` out of it. The style-context restriction
  is what keeps it off the domain: `keyArt: { color: 'punch' }` and
  `<NamePill color={row.color} />` carry a Key Art or Player Color *name*, which
  is protocol from game-core, and a rule firing there would be firing on the
  vocabulary — and the two shadow props are read on `StickerSurface` itself
  rather than on any tag using those words, since `depth` is an ordinary name
  for a tree node's nesting.

  Two literals pass, each because it is the *absence* of a design value rather
  than one of Boardwalk's: numeric `0` for a radius, a border width or a shadow
  depth (`depth={news?.depth ?? 0}` on a seat with nothing to say is real code),
  and `'transparent'` for a colour, which is the same argument in the same shape
  — `StickerSurface` draws its border that way so the fill cannot escape past
  the ink. Neither has a token because the palette has nothing there to name, so
  without the exemption the only exits would be inventing one or an
  `eslint-disable`.

  Arithmetic is judged by what it is made of rather than waved through as an
  expression, so `24 + 0` is still 24 and `radius.pill + 4` is a design decision
  wearing a token as a disguise. That hole was worth closing above the two left
  open below: those need a developer to restructure their code, this one needed
  four characters.

  A module-level name is *followed to what it holds*, not judged by where it was
  bound. `const HOST_FACE = accentFace(0)`, `const ink = colors.ink` and
  `const BRAND = { border: colors.ink }` all pass, because hoisting a tokenised
  value out of a component for reuse is an ordinary thing to do and a gate that
  objected to it is a gate somebody switches off — which would cost more than
  anything it caught. `const CARD_RADIUS = 24` does not pass, which is the
  distinction the tracing exists to make.

  Sticker tilts, `opacity` and `letterSpacing` are *not* guarded: all three have
  tokens and all three are used, but none is on the criterion's list and each
  would need its own false-positive argument first (`opacity: 0` on a hidden
  view is not a design decision).

  **Scoped repo-wide, and it cost nothing to do so.** Enabled for every `.ts`
  and `.tsx` outside `packages/ui/src` — the same exemption the hex scan makes,
  for the same reason: the theme is where a design value belongs. The hub apps
  were expected to need cleanup and did not; `pnpm lint` came back green over
  `apps/tv` and `apps/controller` with no change to either, so scoping the rule
  to trivia alone would have been choosing a weaker gate for nothing.

  **Proved by failing, not by reading.** Five violations were introduced one
  class at a time and `pnpm lint` named each on its line: `borderWidth: 3` and
  `color: '<ink>'` and `fontFamily: 'Bungee_400Regular'` in `tv-screen.tsx`,
  `depth={6}` on a `StickerSurface`, and — in `apps/tv/app/index.tsx`, to show
  the repo-wide scope is real — a module-level `const HUB_RADIUS = 24` used as
  `borderRadius`, which is the likelier dodge than an inline literal and is
  caught by resolving the value's root name to its binding. All were reverted;
  the gate is green. Twenty-one tests in
  `eslint-rules/boardwalk-tokens-only.test.ts` pin the same behaviour by driving
  ESLint over the repo's real config rather than through `RuleTester`, so a
  config that stopped switching the rule on would fail them too — including one
  that lints the actual trivia screens and expects silence. Review then spent
  its effort trying to get violations *past* the rule; seventeen dodges held,
  and the six that did not are folded in above and below.

  **What it does not catch**, and this list is the write-up's credibility. A
  style object built outside `StyleSheet.create` and passed in by name
  (`const chip = { borderWidth: 3 }; StyleSheet.create({ chip })`) is invisible
  to it — nothing in the repo is written that way, and widening the rule to
  chase it would mean guessing which plain objects are styles. The style sheet
  is likewise recognised by *name*, so aliasing it steps around the rule
  entirely (`import { StyleSheet as SS }`, or destructuring `create` off it);
  the same goes for a computed key, a literal laundered through `String()` or
  `JSON.parse()`, and a module-level IIFE's own locals. None of those is
  plausible so much as possible, and each costs a developer more effort than
  writing the token would. A local (non-module) `const` holding a literal slips
  for the reason the module-level tracing stops where it does: a name bound
  inside a component is data flowing through it. And a wrapper around
  `StickerSurface` escapes the two shadow props, which is the price of reading
  them on that element instead of on the word. Finally, the rule is about
  *where* a value is written, not about whether the value is right:
  `radius.pill` used where the handoff wants `radius.card` passes, and always
  will. That half is what a design-fidelity comparison is for, and it is the
  sibling task above, not this one. Nothing here has been on a simulator — this
  task's deliverable is a gate, and the evidence for a gate is that it fails.

  Machinery this needed, recorded because it changed shared files: a fourth
  Vitest project (`lint-rules`) since the rule lives beside `eslint.config.js`
  rather than in a workspace package, `--project lint-rules` added to
  `test:unit` so CI runs it, and `eslint-rules/**/*.ts` added to the root
  `tsconfig.json` so the test is typechecked. The rule itself is CommonJS
  JavaScript — the only such file in the repo besides `eslint.config.js`, which
  `require`s it, and nothing here compiles a config.
Split on 2026-08-01: the two halves of "TV legibility" cannot be closed by the
same means. The floor is arithmetic over the rendered styles and an agent can
finish it; the 3m reading needs eyes in front of a television and cannot be
ticked on a simulator, so bundling them meant a checkbox that could never go
green. The second half is now grouped with the phase's other human-only work.

- [x] Design fidelity — the TV's 18px floor — AC: every piece of body text the
  TV app and the trivia TV screen render is ≥18px at the 720p design size,
  established against the rendered styles rather than by eye, and enforced by
  something that fails when a smaller one is added — the sibling task above
  built `boardwalk/tokens-only` for exactly this shape of problem, and the
  handoff pins the floor ("TV minimums: body text ≥ 18px at 1280×720"). Note
  that `minBodyFontSize.tv` already exists and is already used in places, so
  the work is finding what does *not* use it and deciding whether each is body
  text.

  **Nothing was under the floor, and no rendered size changed.** Twenty-nine
  text styles are drawn on the two television surfaces — eighteen in
  `apps/tv/app/index.tsx`, eleven in `packages/games/trivia/src/tv-screen.tsx`
  — and the smallest of them is 18. Four already read `minBodyFontSize.tv`
  (`roomChipLabel`, the carousel's `chipText`, `unknownGameText`, `seatName`),
  the rest sit above it, and the classification below is what the rest of the
  work rests on. So this task changed no pixel on any television and needs no
  screenshot; its whole deliverable is the gate, and a gate's evidence is that
  it fails.

  **The `TvStage` model was checked rather than assumed.** The TV app is
  authored on a fixed 1280×720 surface and scaled to the panel by one
  transform (`apps/tv/src/tv-stage.tsx`), so a `fontSize` in these stylesheets
  *is* the design-size number and the AC's "at the 720p design size" needs no
  conversion. Nothing in either file sizes text off `useWindowDimensions` or
  `PixelRatio`.

  **Body text is everything with a size except Boardwalk's display face.** That
  is the judgement the task asks for, and the discriminator is the system's
  own two faces rather than a list of screens: Bungee is the display face and is
  never asked to carry a sentence, Space Grotesk is body. So the wordmark (34),
  the room-code chip (24), key art and card titles (46/34/34), the game title
  (34), GRAB YOUR PHONE! (20), a Room Code letter (88), a seat's monogram (24),
  trivia's Countdown (36), its question (44), its tick and verdict marks
  (30/24), its score (26), FINAL SCORES (24), the Victory headline (52) and a
  rank (22) are display type and outside the floor. Everything else is body and
  inside it: the `room` label (18), the carousel card's chips (18), the Carousel
  Footer Line and its greeting (22), the Unknown Game line (18), the pairing
  caption (22), the trouble chip (22), the QR caption (20), a Seat's nickname
  (18), the roster footer (22), trivia's QUESTION/ANSWERED chips (20), its
  option labels (30) and its name pills (22). Two of these were worth arguing
  and neither was reclassified to avoid work: a seat's nickname is body at
  exactly the floor because a seat is only as wide as its avatar, and the trouble
  chip is body at 22 because it is the one line on the screen that has to be read
  and acted on. The page dots carry no text at all, so there was nothing there
  to classify; the wordmark's period is a nested `<Text>` that sets only a colour
  and inherits its parent's 34.

  **A second rule, not an option on the first** (`boardwalk/body-text-floor`).
  `boardwalk/tokens-only`'s entire defensibility is the sentence that it keys on
  a property's *name* and never on a value — which is what lets `width: 148` and
  `fontSize: 88` stay plain numbers without a gate objecting. This rule is that
  sentence inverted: `fontSize` may be any number and the only question is which.
  Folding them together would have made one rule that contradicts its own
  documented boundary, and would have needed two enablement scopes for one rule
  besides. They share the walk to a style object — `StyleSheet.create`'s
  argument and any `style`/`…Style` prop, now `eslint-rules/style-objects.js`,
  extracted from `boardwalk-tokens-only.js` unchanged — and nothing above it.
  That extraction is the one file this task touched that it did not create.

  **Which files stand on a television is the config's question, not the rule's**,
  since `files` is exactly what flat config is for. Switched on for
  `apps/tv/**` and `packages/games/*/src/tv-*.tsx` with `surface: 'tv'`. A
  repo-wide 18 would have been wrong rather than merely strict: the handoff
  floors a phone at 14, and the Controller has two 13s today
  (`label` is body and genuinely under the phone floor; `hostPillText` is
  `fontFamily.display` and outside it either way). Left alone deliberately
  rather than swept in — this AC is the television's — and written up as its own
  Phase 5 task ("Design fidelity — the phone's 14px floor") below, so that a
  known violation of the handoff is recorded where the plan can see it rather
  than only in a comment inside a rule that does not run there. (That last
  sentence is this task's own state and has since been superseded: the phone
  task below switched the rule on for `apps/controller` and took the label to
  14. Left standing as the record of what was true here.)
  The `tv-*` glob is the only handle a config has on a game's television screen,
  so a module that drew its TV screen out of a file named something else would
  sit outside the gate.

  **The floor is written in `eslint.config.js` and pinned to the token by a
  test.** Nothing in this repo compiles a config, so a CommonJS rule cannot
  import `minBodyFontSize` from `@huddle/ui` — the number has to be written
  somewhere outside `packages/ui`, which is the one place this repo says a design
  value may not be. The closure is a test that reads the resolved config for a TV
  file and asserts the option deep-equals the imported token, so the two cannot
  drift. The *whole* table is handed to the rule rather than the one number, and
  that pays for itself: `fontSize: minBodyFontSize.phone` on a television — a
  phone screen ported to the TV keeping the floor it was authored against, which
  is the likeliest way a real screen ends up under it — is then a size the rule
  can read rather than a reference it waves through.

  A size is followed the way its sibling follows a colour: through a
  module-level constant (`const CAPTION = 15`) and through arithmetic, so
  `minBodyFontSize.tv - 2` folds to 16 and is caught, and both arms of a
  conditional are judged. A size bound inside a component, or arriving as a prop,
  is data flowing through the screen and passes.

  **Proved by failing.** Four violations were introduced one at a time and
  `pnpm lint` named each on its line: `fontSize: 16` on the pairing caption in
  `apps/tv/app/index.tsx` and on trivia's chips in `tv-screen.tsx` (both
  reported "this is 16px at the design size"), then the two dodges — the same
  caption as `minBodyFontSize.tv - 2` and the same chip through a module-level
  `const TRIVIA_CHIP = 15`, reported as 16 and 15. All were reverted and lint is
  green. The exemptions were checked the same way rather than argued: Boardwalk's
  badge at `fontFamily.display` with `fontSize: 12` on the TV lints clean, and
  the Controller's two 13s lint clean because the rule is not switched on there
  at all. Fifteen tests in `eslint-rules/boardwalk-body-text-floor.test.ts` pin
  the lot by driving ESLint over the repo's real config — including one that
  lints the actual TV screens and expects silence, and one that lints the same
  sub-floor sample at a TV path and at a Controller path and expects a complaint
  from only the first.

  **Three things review found, one of them in the sibling rule.** The tracing's
  cycle guard was carried across a whole walk rather than down a path, so a name
  read twice in one expression looked like a name being followed round forever.
  In this rule that failed *permissive* — `const HALF = 8` with
  `fontSize: HALF + HALF` slipped while `HALF * 2` was caught — but the same
  shape in `boardwalk/tokens-only`, which is where the walk came from, failed
  the other way: `const ink = colors.ink; const BRAND = { border: ink, text: ink }`
  reported Boardwalk's own token as a value of the file's own. A false positive
  on correct code is the worse of the two, and it was live from the sibling task
  until here. Both now copy the set per branch, with a test each. Second, the
  display exemption was granted on the *shape* of a name (anything
  `…​.display`) while the floor table's provenance was proved through imports
  and module aliases; two standards for "is this really the theme's?" in one
  file is an invitation to copy the weaker, so one `isThemeToken` now answers
  both, and `const faces = { display: 'Comic Sans' }` no longer earns the
  exemption. Third, the deferral of the Controller's 13px `label` pointed at a
  phone task that did not exist; it does now, above, unticked.

  **What it does not catch.** A `<Text>` with no size anywhere in its style
  chain renders at React Native's own 14px, which is under the floor and
  invisible to a rule that only reads style objects — finding it would mean
  resolving style names across files. Every `<Text>` on both television surfaces
  sets a size today, and that was established by reading all thirty-nine of them,
  not by the gate. The display exemption is forward-looking rather than
  load-bearing: the smallest display size on either surface is 20, so nothing in
  the repo currently sits in it. And every gap `boardwalk/tokens-only` documents
  above it is inherited whole, since the walk is the same one — an aliased
  `StyleSheet`, a style object built outside `create` and passed in by name, a
  computed key. Nothing here has been on a simulator or a television, and nothing
  needed to be: no rendered size moved.
- [x] Design fidelity — the phone's 14px floor — AC: every piece of body text
  the Controller and the trivia controller screen render is ≥14px, and
  `boardwalk/body-text-floor` is switched on for them so a smaller one fails
  `pnpm lint`. Raised by the TV task above rather than found by a sweep, so what
  it already knows is written down here: **one known violation**,
  `apps/controller/app/index.tsx:1409` — the uppercase field `label` at 13px,
  `fontFamily.bodyBold`, and body text by any reading. The other 13 on that
  screen (`hostPillText`) is `fontFamily.display` and outside the floor either
  way, which is the same boundary the TV task drew. **The mechanism already
  exists**: the rule is handed Boardwalk's whole `minBodyFontSize` table and
  told which surface a file set stands on, so the phone is a config glob
  (`apps/controller/**`, `packages/games/*/src/controller-*.tsx`) and
  `surface: 'phone'` — a second config block in `eslint.config.js`, not a second
  rule and not a change to this one. What is *not* settled and is the actual
  work: whether that label goes to 14 or to `minBodyFontSize.phone`, what it
  costs the two screens it appears on at a size a thumb's width wider, and
  whether the sweep the glob then performs turns up anything the TV task had no
  reason to look at. A phone is read from the hand, so unlike the television's
  floor this one can be judged on a simulator.

  **A config glob and nothing else, as forecast.** `apps/controller/**` (both
  extensions, as the TV block does) and `packages/games/*/src/controller-*.tsx`,
  with `surface: 'phone'` and the same `MIN_BODY_FONT_SIZE` table. Checked
  rather than assumed on both edges: the glob's own reach is the app's `app/`
  and `src/` and nothing more — `.expo/`, `expo-env.d.ts` and `ios/Pods` hold no
  authored `.ts`/`.tsx` and the first two are globally ignored anyway — and a
  file on *neither* surface still has no floor, which is a test of its own,
  because the second block widening quietly over the first is the failure mode
  of a two-block config. `packages/ui` is the case that names the boundary: both
  clients import it, so a shared primitive stands on no one surface and can be
  given no floor. Nothing in it sets a `fontSize` today, which is a fact read
  rather than a fact enforced.

  **The catalogue, by the technique the TV pass used**: the rule run over both
  phone surfaces with an absurd floor, so it names everything it considers body.
  Twenty-six sizes, fifteen body and eleven display. Body: the name field (18),
  the primary button's label (18), the failure line (15), a roster nickname
  (16), the aside (15), the picked game's meta and position (15/15), the
  name of one setting (16) and one of its chips (15), the waiting line (15), the
  status card's sentence (16), trivia's answer buttons (20), its LOCKED IN pill
  (14) and its eyes-up line (18) — and the field `label`, at 13. Display, and
  outside the floor: the wordmark (20/16), "Join the room" (28), a code tile's
  letter (36), the HOST pill (13), the code chip (20), the hero monogram (42), a
  roster monogram (14), a picker chevron (30), the picked title (22) and
  trivia's question (22). Two are worth arguing. **The HOST pill at 13 is the
  only place in the repo where the display exemption is load-bearing** — on the
  television the smallest display size is 20, so the exemption was forward-
  looking there and is not here. It is defensible because the exemption cannot
  be claimed on a line: it costs `fontFamily.display`, an actual change of face,
  and Bungee's caps at 13 stand taller and heavier than Space Grotesk's. And
  **trivia's LOCKED IN pill is body at exactly 14** rather than display, which is
  the same call the TV pass made for a seat's nickname: it is a badge, but it is
  set in Space Grotesk, and a badge is where a reader looks to find out whether
  their tap registered.

  **The label goes to 14, and the handoff contradicts itself about it.** §2
  writes "ROOM CODE label (13px, letter-spacing 2px, bold, muted)" while the
  same document's typography tokens floor phone body at ≥14px. That is not this
  repo's rule colliding with the handoff — it is the handoff colliding with
  itself, and it is now recorded as such in `docs/design/design-handoff.md`
  under §2 rather than silently resolved in code. The floor wins, for two
  reasons that are the document's own: its two type roles are Display (Bungee)
  and **Body/UI** (Space Grotesk 400–700), so a bold muted label in Space
  Grotesk is what "phone body" names; and a floor a single per-screen line can
  undercut is not a floor. An `eslint-disable` was the live alternative and was
  rejected on what it would mean: the phone gate's first act would be to exempt
  the one violation it was built to catch.
  Written as `minBodyFontSize.phone` and not as `14`, because this element's
  handoff measurement is 13: a bare 14 in a stylesheet of handoff numbers would
  read like one more of them and hide which of the document's two lines won.

  **Six labels on three screens; five of them measured.** ROOM CODE and YOUR
  NAME on §2; YOUR ROOM, YOUR COLOR and YOU'RE THE HOST — PICK A GAME on the
  Host's merged §4/§5/§7 screen; YOUR COLOR again on the player's §4; and
  SETTINGS, which mounts only once a game with settings is picked and is on
  neither frame. A/B'd on an iPhone 17 by flipping the one number and letting
  fast refresh redraw the screen that was already up, so each pair differs in
  that number and nothing else (`tools/design-fidelity/`, frames 14 and 15).

  The growth is **proportional to the glyph run, not a constant**, because
  `letterSpacing.label` is a fixed 2pt per character that does not scale with
  the size: the four short labels each gain 5.67pt and the 29-character one
  gains 15.33 (256.67 → 272.00), which is the same ~6% of width in both cases.
  Predicted the same way to within about 0.35pt — glyphs × 14/13, spacing held,
  the residual being the space glyph's own advance, which scales where the model
  holds it fixed — which
  is why SETTINGS is left uncaptured rather than guessed at: it is the same
  `label` style, one word long, so it gains less than any label that *was*
  measured, and the ~2.7pt it adds to the picked-game screen's column is
  **inferred from the shared style rather than observed**.

  **Nothing wraps and nothing reflows.** The longest label lands at 272.0pt in a
  354pt column and would have to grow another 30% to break. What moves is
  vertical, about 1.3pt per label, so §5's roster row starts at 412.67pt where
  the roster task measured 411.3 — measured on row 1 of a one-player room, since
  that is the room the frames hold.

  **Three pieces of prose went stale, not one**, and all three are fixed here:
  `hostPillText`'s comment, which founded its 13 on the label's 13; this rule's
  own docblock, which said the config "leaves the phone alone" and called the
  display exemption a hole nothing sits in; and `docs/tech-stack.md`, which said
  the config knows which files stand on a television. A gate whose rule
  documents the opposite of its config is a gate a developer reads as misfiring.

  **Proved by failing.** With the block added and the label still at 13,
  `pnpm lint` reported exactly one problem, on its line:
  `apps/controller/app/index.tsx:1409 Boardwalk floors phone body text at 14px
  and this is 13px at the design size`. One and not two — the HOST pill on the
  same screen at the same 13 lints clean, which is the exemption proved by the
  gate rather than by argument. Six tests were added to
  `eslint-rules/boardwalk-body-text-floor.test.ts` (24 there, 601 in the repo):
  the config test now walks all four file sets and asserts the surface *and* the
  whole table on each, a companion asserts a shared package gets no floor at
  all, the phone's real screens are linted and expected silent, 13 is caught at
  both phone paths with `minBodyFontSize.phone` named in the message, and one
  pair pins the thing a single repo-wide number would break: 15 is refused on
  both television paths and passed on both phone paths, while 12 is refused
  everywhere.

  **What is still open.** The gap the TV pass documented is inherited whole — a
  `<Text>` with no size in its style chain is invisible to a rule that reads
  style objects — but it is toothless on this surface for once, since React
  Native's own default is 14 and that *is* the phone floor. Only the television
  is exposed by it. All fifty-two `<Text>` on the phone were read anyway, to the
  same standard: forty-eight name a sized style and the other four are the
  wordmark's period, which sets a colour and inherits its parent's 20 or 16.
  Legibility itself is still unjudged: 14px was read on a
  simulator at ×3 on a desk, which settles that the labels fit and not that they
  are comfortable in a hand at arm's length; that belongs to the play-test gate,
  as the 3m trivia question does. And the handoff's §2 line is annotated, not
  changed at source — the mock in the design project still says 13, so anyone
  re-fetching it will find the same contradiction.
Two findings from a cleanup pass on 2026-08-02, after the phase's last
agent-doable task. Both are placed here, ahead of the human-only work, because
an agent can close them and everything below needs hardware in the room.

- [x] A room nobody joins is never deleted, so Room Codes leak — AC: a room
  whose television has gone is eventually deleted and its code returned to the
  pool, with an integration test that pins the case a live room must survive
  (a TV showing a code to a party that has not arrived yet).

  **Fixed on 2026-08-02 with the constant, not the television heartbeat.**
  `createRoom` arms one check against every room it mints —
  `expireUnjoinedRoom`, at `UNJOINED_ROOM_EXPIRY_MS` (two hours,
  `packages/game-core/src/room-expiry.ts`, beside `ROOM_EXPIRY_MS`) — which
  deletes the room if and only if its roster is still empty when the check comes
  due. It is a single check and is never re-armed: a join hands the room to the
  ten-minute desertion clock permanently, so a seat found here means the check is
  spent rather than that it should look again. It deletes no players, because it
  can only ever run on a room that has none.

  The heartbeat was the bigger idea and was rejected on the AC's own hazard. A
  television that beats is a television that can *stop* beating while it is
  switched on and a party is walking in — so the shape meant to protect a live
  room is the shape that can take one, which is exactly the naive fix the task
  warned about wearing a better disguise. It would also patch the `rooms` row
  every few seconds, the same row every Game Event patches, against a schema
  comment that already argues the other way about the phones. The constant's
  whole exposure is instead "a television shows a code nobody used for two
  hours", and the recovery from that is a round trip: `useRoomExpiry` sits in
  `OpenRoomStage`, which wraps the pairing screen, so a collected room reopens
  and draws a fresh code rather than stranding a dead one. Two hours is 12× the
  desertion clock and two orders of magnitude more than the gap between a
  television being switched on and the first guest arriving.

  **The must-survive pin is the strong version, and was mutation-checked at
  review rather than trusted.** The party joins 60s *before* the check fires, so
  the check runs mid-evening and has to find work to skip, and the test asserts
  the roster as well as `stillOpen` — a fix that deleted the room but left the
  player rows still fails it. Four mutations, each failing exactly the test that
  owns it and nothing else: dropping the seat guard (the naive fix) fails
  `stops being one the moment somebody joins`; never arming the check fails both
  deletion tests; arming at half the window fails the two survival tests; and
  throwing instead of returning on a missing room fails the already-ended-party
  test, so that one is not vacuous either.

  Review also traced independently that the new clock can never take a room a
  party is using: the only `db.delete` of a player anywhere in the backend is
  inside `expireRoom`, which deletes the room in the same transaction, so an
  empty roster at the two-hour mark means either nobody ever joined or the room
  is already gone. There is no leave-room mutation. And an unjoined room can hold
  nothing that would be orphaned — every mutation in `games.ts` is Session Token
  gated, so a room with no players can carry no `game`, no deadline and no
  browsing index.

  What this does not carry: **the check is prospective, so the leak that found
  this task is still on the deployment.** The 100+ stranded rooms were minted
  before `createRoom` armed anything and have nothing scheduled against them;
  they will hold their codes forever, and the dev deployment will still count
  100+ rooms against 0 players after this ships. That is 100 of 390,625 codes and
  the AC is about behaviour rather than a backfill, so it was left — but anyone
  who counts the deployment again should read this paragraph before concluding
  the fix did not land. Clearing them is one `npx convex import --table rooms
  --replace` against a live deployment; sweeping them, and covering any future
  case where a scheduled check is lost, wants a cron, and there is no
  `convex/convex/crons.ts` today. Nothing here has been watched on the real
  scheduler the way Phase 2's ten-minute clock was — a two-hour window is not
  something a session waits out — so the arming is `convex-test` on a fake clock
  plus the birth-armed job being visible in `_scheduled_functions`.

  Found by counting the dev deployment, not by reading: **100+ rooms and 0
  players**. Every one is a launch that opened a room and never got a join.
  Rooms that *did* seat somebody expired correctly and took their players with
  them, which is exactly why the two counts look like that.

  The mechanism is in `convex/rooms.ts`. `expireRoom` deletes a room and its
  players together, but `watchForDesertion` returns early on
  `seated.length === 0` — and that early return is *right* for the case it was
  written for: "a room nobody has joined has not been deserted", so a
  television showing a Room Code to an empty living room keeps it. What is
  missing is that nothing distinguishes that television from one switched off
  yesterday, so the room and its code are held forever.

  Slow but monotonic, and it never improves on its own:
  `drawUnusedRoomCode` redraws `MAX_CODE_DRAWS` times against a 390,625-code
  pool (25⁴, I having been dropped from minting) and then throws
  `roomCodeExhausted`. This is a Phase 2 lifecycle gap rather than anything
  Phase 5 introduced — it is filed here because this is where it was found.

  The obvious shapes are a much longer idle timeout for a room that has never
  seated anybody, or a heartbeat from the television itself the way phones
  already beat. The second is the bigger change and would also let the room
  know its TV is gone; the first is a constant. Whichever, the AC's test
  matters more than the mechanism: the failure mode of a naive fix is deleting
  the code off a working television mid-party.

- [ ] Delete the TV's unreachable seat code — AC: `PlayerSeat`,
  `seatHighlightShadow`, `seatHighlight` and the away styling are gone or
  demonstrably reachable, and no doc still defers anything to them.

  They are unreachable in any shipped build, and this is checkable rather than
  argued: `GAME_REGISTRY` holds one module, so `carouselWindow` never returns
  `undefined`, so `CarouselStage` always wins the moment `seats.length > 0` and
  `RosterFooter` is only ever reached with an empty roster. `EmptySeat` still
  draws; everything that needs a *player* does not.

  This is not tidiness. Three earlier tasks each deferred a pill — HOST, JUST
  JOINED!, away — to this component, and the "TV carousel closes its two
  departures" task spent a review round on a decision record that cited its
  tangerine shadow and away dimming as live channels when neither can appear.
  Dead code that documents itself as dead is the minimum; deleting it is the
  fix.

  Note before starting: `seatHighlight` in `apps/tv/src/roster.ts` has its own
  passing tests, so the suite will not notice its removal — that is the point
  rather than a reason to keep it. Check what `apps/tv/src/just-joined.ts` is
  still for once the seats go; the carousel's greeting uses `Arrivals` and
  `isArrival`, so part of it stays and part may not.

- [ ] Decide whether Room Codes take `I` back — AC: `ROOM_CODE_MINT_ALPHABET`
  either returns to the full A–Z or keeps its 25 letters with the reason
  recorded against the constant, rather than sitting as an unexplained scar.
  The tile bug it worked around is fixed and A/B'd (see the first task of this
  phase), so the narrower alphabet is now a spare belt rather than the only
  one. Reading a code must stay at the full A–Z either way — rooms minted
  before the change are still typeable off a television.

- [ ] Design fidelity — the trivia question read from 3m (human-only) — AC: a
  human sits 3m from a television running the trivia TV screen and can read the
  question. Cannot be closed on a simulator and must not be ticked from a
  screenshot — it is the one legibility fact that only a room can settle. Do it
  inside the play-test gate below rather than as a trip of its own, since that
  gate already puts a person in front of a television with a game running.
- [x] Design fidelity — the two handoff animations — AC: the avatar pop-in
  spring (~300ms) and the carousel transition (~250ms) are implemented per the
  handoff, with the durations coming from theme tokens rather than numbers at
  the call site, and each one watched running rather than only coded.

  Both built and both **watched running** on 2026-08-01, on the Apple TV 4K
  (3rd generation) **at 1080p** simulator (tvOS 26.5, 1920×1080 = ×1.5 of the
  design stage) against the cloud dev deployment, off the Debug build of
  2026-07-31 with Metro serving this working tree. The frames are
  `tools/design-fidelity/16-tv-carousel-transition.png` and
  `17-tv-arrival-pop-in.png`, each a strip of real frames at their real
  presentation times. Everything on these screens was **seeded** —
  `players:joinRoom` for the arrivals, `games:browseGame` with the Host's own
  Session Token for the browsing — since the television takes no input and
  renders the room.

  **The instrument, because a still frame cannot show a spring.** `simctl io
  screenshot` takes longer to return one frame than either animation takes to
  run, so these were recorded (`simctl io recordVideo`, 60fps) and read back
  frame by frame with `tools/motion-frames.swift`. Two traps it exists to
  handle: the recorder writes frames only while the screen is changing, so a
  recording of a still television is one frame and an animation is a *burst*;
  and an interrupted recording's index stops before its samples do, so seeking
  with `AVAssetImageGenerator` answers every request past that point with the
  same last frame it can find — which read as "the animation ran in 8ms" until
  the tool was changed to decode the track through with `AVAssetReader`.

  **The durations are tokens** (`packages/ui/src/motion.ts`: `motionDuration`,
  `popIn`, `springOf`), which `boardwalk/tokens-only` does *not* enforce — it
  keys on the property names of a style object and a duration is an argument to
  an animation. Said plainly because the AC asks for tokens and the gate that
  looks like it would catch a regression here would not. `springOf` is the part
  worth reading: `Animated.spring` takes stiffness, damping and mass rather than
  a duration, so "~300ms spring" is carried as the spring's natural period and
  converted (unit mass, ω = 2π/T, c = 2ζω). Five tests pin the conversion — the
  period comes back out, the damping ratio comes back out, and both ends of the
  ratio are refused.

  **(a) The carousel transition is a 250ms cubic ease-out, and it was measured
  against the curve.** The row of cards starts 96pt off in the direction the
  room browsed (`cardEntryOffset`, four tests) and eases to 0.
  Measured off the recording by the centroid of every non-cream pixel in the
  card band, in design points, against `96·(1−t/250)³`:

  | | forward (0→1) | back (1→0) |
  |---|---|---|
  | first frame at the full offset | +95.59pt | −95.59pt |
  | worst residual against the cubic, 15 frames | **1.32pt** | **0.42pt** |
  | settled | 285ms after the burst starts | 284ms |

  The leftmost drawn pixel moves 144px at ×1.5 — 96pt — which is the same claim
  without the arithmetic. Two things the fit says that the code does not. It is
  *cubic* ease-out in fact and not only in name: a curve fitted at 250ms lands
  within 1.32pt of every frame, which no other easing in the family does. And
  the animation's own zero is **22.5ms after the frame that first shows the row
  at its full offset** (26.2ms browsing back) — 1.3 and 1.6 frames at 60fps, the
  `useLayoutEffect` reset landing in the commit and the native driver beginning
  to step on the frame or two after it. Two clocks are easy to confuse here and
  the frames are labelled in the first: the strip's `+0ms` is that full-offset
  frame, while the *burst* starts earlier still — 1.3 frames, the recorder's
  gaps not being uniform — on the last frame of the old layout, so the same
  zero is 44.5ms from the burst's first frame, and
  quoting that number without its origin is what an earlier draft of this
  paragraph did.

  **It cannot be watched on a build that installs one game**, and that is worth
  saying in the plan rather than only in the handoff: the Registry ships trivia
  alone, so `browsingGameIndex` has nowhere to go and the transition has nothing
  to animate. It was driven against a patched Registry of two
  (`tools/carousel-transition-repro.patch`, reverted; the second card is
  trivia's own module under another id and key art). The patch has to reach the
  *server* too — `browseGame` clamps the index against the deployment's
  `GAME_LOGIC_REGISTRY`, so a patched client alone leaves a perfectly still
  television, which is exactly what the first recording caught.

  **(b) The pop-in moved to the surface that inherited what it announces, and
  that judgement is the task.** The handoff hangs it on the §3 TV card of the
  player who joined; §3 is never coming, and the pairing Seat that stood in for
  it is only drawn for an *empty* room — `PlayerSeat` is unreachable in a
  shipped build, as the "TV carousel closes its two departures" task established.
  A spring there would have satisfied the checkbox and run for nobody. What
  survived §3 is the greeting: the Carousel Footer Line hands its four seconds
  to the newest Arrival, in punch, on the screen the party is looking at — and
  it appeared with no motion at all. So that line is what pops in: same event,
  same treatment, same 0.6→1 with slight overshoot at ~300ms. **A party sees a
  sentence spring in, not an avatar.** There is no avatar on this television
  after the first join, and the §4 phone avatar was considered and refused —
  a spring there fires on a rejoin as well as an arrival, and only its owner
  would ever see it, which is the opposite of what the handoff's line is for.
  §5's deferred NEW! pill is untouched by this and stays deferred.

  Measured off `17`, by the punch glyph run's width in design points against its
  settled width:

  | | +0ms | +80 | +130 | +163 | +213 | +297 | +362 |
  |---|---|---|---|---|---|---|---|
  | measured scale | **0.598** | 0.74 | 0.92 | **1.00** | **1.04** | 1.02 | 1.00 |
  | closed form, τ = t − 30ms | 0.600 | 0.738 | 0.927 | 1.001 | 1.038 | 1.013 | 0.998 |

  So: it starts at the token's 0.6, crosses 1 at ~163ms, peaks at 1.04 around
  213ms, and is settled by ~360ms — one slight overshoot, which is what the
  handoff asks for and what the frames show.

  **The frames agree with the closed form, and the second row above is that
  claim.** `x(τ) = 1 − 0.4·e^(−ζωτ)(cos ω₁τ + 0.75 sin ω₁τ)` with ζ = 0.6 and
  ω = 2π/0.3 — the spring `springOf` builds, nothing fitted but the origin —
  lands within **0.005 of scale** on all 21 measured frames. Two things have to
  be right for that to come out, and an earlier draft of this paragraph got both
  wrong and invented an anomaly out of them, which is why they are written down:

  - **The overshoot is a fraction of the travel, not of the settled value.**
    `e^(−πζ/√(1−ζ²))` = 9.48% of a step that is 0.6→1, so the predicted peak is
    `1 + 0.0948 × 0.4` = **1.038** against **1.04** measured. Read against 1.0
    instead it looks like the television overshot half as far as it should have.
    `motion.test.ts` already treats that formula as a fraction of travel; only
    the prose had it as a fraction of the settled scale.
  - **The lag is a constant ~30ms origin offset, not a dilation** — the same
    instrument fact the carousel section measures at 22.5ms, and for the same
    reason: the first frame of the burst is the reset, and the driver starts
    stepping one or two frames later. With τ = t − 30 the crossing lands at 162
    against 163 measured and the peak at 217 against 213–228. A ×1.20 dilation
    is decisively *rejected* by the same frames — it predicts 0.81 at +80ms
    against 0.74 measured, a residual fifteen times the offset model's worst.

  The ×20 rehearsal (the same spring at 6000ms) was an instrument check and not
  evidence: it proved the recorder captures continuous motion, at 60fps for 3s.
  Read as data it is mostly the rise — at that duration the model does not reach
  1 until 2.64s — and it tracks the model to within 0.05 of scale through the
  first 1.5s, then lags and flattens near 0.89 where the model is still climbing.
  That tail is on the part of a recording whose end the encoder was already
  dropping (every recording here lost its last seconds), so it is not a fact
  about the spring, and nothing in the real-speed capture behaves that way. On a
  real television none of this is tested, like every other measurement in this
  phase.

  **The footer's measured daylight survives the motion**, which was the thing
  most at risk. Both animations are transform-only, so neither is laid out; and
  at the spring's 1.04 peak the greeting's cap top reads 662.67pt against the
  focused card's cobalt shadow ending at 652.67pt — the same 10.00pt as at rest,
  inside the ⅔pt this capture can resolve. The page dots are not inside the
  animated node at all.

  Not tested, deliberately: the timing and the easing themselves. tech-stack.md
  does not test renderers, and a test that asserted `Animated.timing` was called
  with 250 would pass on a screen that never mounted it. What is tested is the
  arithmetic either side — the spring conversion and the slide's direction — and
  the rest is the frames above.
- [x] TV app remote surface — AC: the TV app requires zero remote interaction
  after launch (room auto-creates; everything else is phone-driven); the only
  remote-reachable control is an "About/version" item.

  **The two halves do not contradict each other, and the word that separates
  them is *focus*.** Read plainly the criterion asks for a TV that needs no
  remote *and* for one thing a remote can reach, which is why it is worth
  stating the resolution before anything else: **nothing on any TV screen is
  focusable**, so the remote's directions and its OK button have nothing to
  land on — no highlight moves, nothing opens, and there is no state this
  television waits in for a press. That is "requires zero remote interaction".
  The About Panel is reached *without focus*, by the app listening at the root
  for one key. Two claims, two mechanisms, both true at once.

  **What was already there, checked rather than assumed.** Every TV screen this
  app can show — the pairing screen, the carousel, a game's own screen and the
  unknown-game screen — turned out to hold no `Pressable`, no `Touchable*`, no
  `TextInput`, no scroll view and no `focusable` prop. So the first half of this
  task was a *proof*, not a change: `apps/tv` and the Registry's `tv-*` screens
  are made of `View`, `Text`, `Animated.*` and `StickerSurface`, which is a
  `View`. The one thing that was missing is what fails when somebody adds the
  first one.

  **The mechanism is a third lint rule, `huddle/tv-remote-surface`**, in
  `eslint-rules/` beside Boardwalk's two and switched on for exactly the paths
  the TV body-text floor covers (`apps/tv/**`, `packages/games/*/src/tv-*.tsx`).
  It fails a focusable component by the name it is drawn with, a focus or press
  prop on any element (`focusable`, `hasTVPreferredFocus`, `nextFocus*`,
  `onPress`, `onFocus`, …), and a remote listener written anywhere but the one
  file the config names. It is a **second plugin** rather than a third Boardwalk
  rule on purpose: Boardwalk is the design system, Eyes up is a line in
  project-scope.md, and a television with a focusable button on it would be in
  perfect Boardwalk style. Its test drives the real ESLint config over every TV
  source file, which is the first half of the criterion written as an assertion
  rather than as a claim; 14 tests, and the app lints clean.

  Two decisions inside the rule worth recording. It keys on **names, not
  provenance** — the reverse of `boardwalk/tokens-only`, which proves a value
  came from `@huddle/ui` before allowing it — because a `Pressable` of
  somebody's own making is exactly as focusable as React Native's, and the name
  on the line is what a reviewer reads too. And it judges the remote's two names
  **wherever they are written**, not only in an import: the first draft watched
  import specifiers alone, and the About Panel's own final shape (below) walked
  straight past it. A gate that the one permitted use can evade is not a gate.

  **The About Panel opens on play/pause**, closes on the next press of
  *anything* including play/pause again, and closes itself after twenty seconds
  regardless. The auto-dismiss is not politeness — it is what keeps the first
  half of the criterion true in the presence of the second: a panel needing a
  second press to dismiss would be a state a guest could put the television into
  and the room would then have to press its way out of. Play/pause because a
  television running a party is not playing media, so it is the button nobody
  reaches for by accident, and because this app binds it to nothing else; it is
  `UIPressTypePlayPause` on the Siri remote and `KEYCODE_MEDIA_PLAY_PAUSE` on an
  Android TV remote. `menu` was rejected because on tvOS it exits to the home
  screen unless the app takes the key over, and an app that is hard to leave is
  worse than one with no About Panel. Android reports a key twice (down, then
  up) where tvOS reports a tap once on the way up, so the panel acts on the
  release — without that, one Android play/pause would open the panel and close
  it in the same instant.

  **A correction, kept rather than quietly fixed, because of what it is about.**
  The first version of this task claimed play/pause was *the only key that
  reaches an app with nothing focused* — that on tvOS `select` came from a
  focused view and so "the OK button emits nothing at all". That is wrong, and
  the source contradicting it was in this repo's own `node_modules` the whole
  time. `RCTTVRemoteHandler` really does install no `select` recogniser, which
  is where the mistake came from; but tvOS constructs a **second** handler on
  the next line of the same call site — `RCTRootView.m:104-105`, and
  `RCTSurfaceHostingProxyRootView.mm:183-184` for the Fabric path this app
  actually takes — and `RCTTVRemoteSelectHandler` attaches a `UIPressTypeSelect`
  recogniser **to the root view**, posting `select` with `keyAction: 1` from
  `sendSelectNotification` regardless of focus. Android never had the condition
  at all: `ReactAndroidHWInputDeviceHelper.kt:60-62` maps `KEYCODE_DPAD_CENTER`,
  `ENTER` and `SPACE` to `select` outright. The four directions likewise reach
  the root on both platforms.
  Nothing in the app changes — `aboutPanelAfter` returns the state it was given
  for `select` when the panel is closed — and the criterion still holds, because
  the criterion is about focus and not about which keys arrive. What changes is
  the justification: play/pause is the key a party will not press by accident,
  not the only key that lands. **It is worth recording that this happened on
  this particular task.** The whole question here was whether reading source can
  stand in for pressing a button, this was the single inference a reviewer could
  independently check, and it was wrong — which is a fair prior for the two
  inferences below that nobody has checked yet.
  One consequence is now a decision rather than an accident: since every press
  closes the panel and `select` does arrive, **OK closes the panel**. That is
  wanted — OK is what somebody who wants it gone presses first, and a panel that
  ignored the most obvious button on the remote would be worse.

  **It shows three lines, because a version alone does not identify a build.**
  VERSION (`0.1.0 (debug)` — the Expo config's, marked when it is a debug bundle
  that dies with the laptop serving it), ROOM SERVER (the deployment host —
  `colorful-viper-224.convex.cloud`, or `127.0.0.1:3210` for the local backend
  this project spent a phase on, or "not configured"), and GAMES (the installed
  Game Modules, which is the fact behind the unknown-game screen). Those are the
  three questions a party actually asks of a television, and the second is the
  one that has bitten this project before.

  Drawn in Boardwalk, which draws no About screen: a card the system already
  knows how to draw — surface fill, 4px ink border, a large card's radius, a TV
  card's 6px offset shadow, a new `stickerTilt.aboutPanel` at -1.5° — with the
  HOST pill's ink badge as its heading. No scrim behind it, because a dimmed
  screen would need a colour Boardwalk does not hold and the hard offset shadow
  is how this system separates a surface from what is under it. It is mounted on
  `TvStage` rather than on any screen, which is what puts it on all four by
  construction instead of by four call sites remembering to.

  **Observed, on an Apple TV 4K at ×3** (frames 18–21 in
  `tools/design-fidelity/`, and its README carries the numbers):
  - The television ran a room from launch to a Host browsing a game with
    **nothing touched at all** — it opened room `JUKL` by itself, a seeded join
    moved it from the pairing screen to §6's carousel, and the footer named Ada.
  - The panel draws as specified over the carousel, reading the real deployment
    off the running bundle.
  - **The auto-dismiss works and the panel moves nothing.** Twenty seconds after
    it was drawn, with nothing touched, it was gone — and the carousel frame
    after it dismissed differs from the frame before it appeared in **0 of
    8,294,400 pixels**. The footer's 10pt of daylight is untouched.

  **Not observed, and the reason is not a small one: no remote was pressed.**
  `xcrun simctl` has no subcommand that sends a remote press. The two routes
  that exist on this machine were both closed — driving the Simulator's remote
  window needs Accessibility, which `osascript` was refused outright
  (`osascript is not allowed to send keystrokes. (1002)`), and the sanctioned
  route, `XCUIRemote.press(.playPause)`, needs a UI-test target this project's
  generated `ios/` has never had. So frame `19` was taken by **forcing the
  panel's state** (`useState(false)` → `true`, fast-refreshed, reverted), the
  same precedent as `16`'s Registry patch. What is therefore **inferred rather
  than seen**: that play/pause summons the panel, that a direction press changes
  nothing on screen, and that a `Pressable` on a TV screen takes focus. The
  first two rest on the recogniser and keycode wiring read in this repo's
  `node_modules` — `RCTTVRemoteHandler.m` and `RCTTVRemoteSelectHandler.m` on
  the tvOS side, `ReactAndroidHWInputDeviceHelper.kt` on Android — and on
  `aboutPanelAfter`, which is unit-tested against every key those emit. The
  third rests on `react-native-tvos`'s documented behaviour and on nothing in
  this repo. Read the correction above before trusting any of them: one
  inference of exactly this kind has already turned out wrong. Frame `21` shows what the rejected
  design looks like — the About item built as a focusable control — and it is
  worth its place for the design argument rather than the focus one: the pill
  lands in the footer row beside the page dots, crowding daylight two previous
  tasks bought, and it is on screen for the whole party.
  **A tvOS UI-test target
  is what would close all three**, and it is the first thing to do if this ever
  needs to be more than an argument.

  One dependency defect found and worked around rather than fixed:
  **`react-native-tvos` types `useTVEventHandler` onto the wrong module under
  pnpm.** It ships the TV APIs as a module augmentation of `react-native`, and
  resolved from inside `.pnpm/react-native-tvos@…/node_modules/react-native-tvos/`
  that bare name finds the *stock* React Native in the store — the copy
  `packages/ui` keeps as a dev dependency — not the tvOS package the app aliases.
  `tsc --traceResolution` says so in one line. Re-declaring it from a `.d.ts` in
  the app does not work either, and that was **probed rather than assumed**: a
  module augmentation may only patch existing declarations, so an added
  `ViewProps` member merged and an added `const` stayed invisible. The hook is
  therefore read off the `react-native` namespace and checked at runtime in
  `tv-about.tsx` — the value is really there and only its declaration is missing
  — with a no-op fallback, because a television that threw on `undefined(...)`
  at launch is a black screen nobody in the room can fix.
- [x] Convex cloud project (development ran on an anonymous local backend at
  127.0.0.1, which real devices cannot reach) — AC: a Convex cloud free-tier
  deployment exists; both apps point at it; TV and phone on real hardware
  share room state. Done early, out of phase order, because the local backend
  was blocking honest verification. `nderim-krasniqi:huddle:dev` is live and
  the TV app points at it; `createRoom`, `joinRoom`, `roster` and all four
  rejections were exercised against it, confirming `ConvexError` data survives
  the wire outside `convex-test`. Still open: the Controller does not point at
  anything yet (it has no Convex client until the join-screen task), and
  "share room state on real hardware" needs the devices in Phase 5.
- [x] A way to actually see the TV app — AC: the TV pairing screen renders
  somewhere a human can look at it. Both simulators now run the real apps, and
  the whole Phase 1 slice has been watched end to end: the TV opened room
  EDFO, a join seated "Grace", and the roster went to "1 of 10 joined" on its
  live subscription with no reload.

  The blockers recorded on 2026-07-27 are resolved, and the note that this
  machine had Command Line Tools only was simply out of date — Xcode 26.5 is
  installed, with both iOS and tvOS simulators.
  - ``Invalid `RNSVG.podspec` file: no implicit conversion of nil into
    String`` is react-native-svg resolving `react-native/package.json`,
    landing in `react-native-tvos/` because of the TV app's alias, looking for
    a sibling `react-native/` that pnpm never created, and reaching
    `File.join(nil, ...)` because its `REACT_NATIVE_NODE_MODULES_DIR` fallback
    was unset. Setting that variable to the app's own `node_modules` — where
    pnpm *does* put a `react-native` symlink — is the fix, and it now lives in
    `apps/tv`'s `ios` and `prebuild` scripts beside the `LC_ALL` CocoaPods
    1.17 on Ruby 4 needs.
  - `expo-router was not linked: supports iOS but target is tvOS` is a
    warning, not a blocker. expo-router declares `platforms: ["apple", ...]`,
    so tvOS autolinking skips its three native modules (`ExpoHead`,
    `LinkPreview`, `RouterToolbar`) — none of which the TV app uses. Routing
    is JavaScript: the app bundles 1698 modules and renders.

  Android was the piece still open here, and the toolchain task directly below
  has since closed it: the hub renders on an Android TV emulator too.
- [x] Android toolchain & the TV app on an emulator (split out of "Real-device
  builds" below, which bundled three targets and silently assumed a toolchain
  that does not exist) — AC: a JDK, the Android SDK and an Android TV system
  image are installed; `pnpm --filter @huddle/tv android` builds and launches
  the hub on an Android TV emulator; the pairing screen renders and its
  roster still updates live on a join. Taken before Phase 2 on purpose: the
  Philips Android TV is the real hub target and nothing has ever run on
  Android, so every Boardwalk measurement, the font loading, and the
  remote-control focus model are unverified there. Expect differences the
  Apple simulators cannot show — `boxShadow` support, Bungee rendering, and
  D-pad focus above all.

  Done: the toolchain is installed (see tech-stack.md's Local Toolchain for the
  exact versions and the reproducible setup) and the hub has been watched
  running on an Android TV emulator. The pairing screen rendered room `SPZJ`
  complete with Bungee and Space Grotesk, the per-letter tile colours, the
  ±1–2° sticker tilts, and the hard offset shadows — so `boxShadow` does work
  under Fabric on this image, and the Google-Fonts loading path is not
  Apple-only. Two joins were then seated live, `Grace` and `Milo`, taking the
  footer to "2 of 10 joined" with no reload, so the Convex subscription is
  real on Android too.

  The Boardwalk scaling survives the platform change for a non-obvious
  reason worth recording: the `tv_1080p` profile is 1920×1080 at density 320,
  which React Native sees as 960×540 **dp**, where tvOS handed the app
  1920×1080 pt. `tvStageScale` therefore resolves to exactly 0.75, and 0.75 dp
  × 2 lands on 1.5 physical pixels per design pixel — precisely the "×1.5 for
  1080p" the handoff asks for. Nothing needed changing, but the app is hitting
  that number by a different route than on tvOS.

  Three things this did **not** establish:
  - **The API level is wrong for the target, deliberately.** `android-36` is
    the only 64-bit Android TV image offered, and this is an Intel Mac; the
    rest are 32-bit x86. Android 16 is far newer than any Philips TV, so this
    validates the toolchain, the renderer and the font path — not the API
    level the real hub will run. `boxShadow` needs API 28+, which is the one
    thing an older Philips could still fail.
  - **D-pad focus is still completely unexercised.** The pairing screen has
    nothing focusable, which is by design (see "TV app remote surface"), so
    the emulator could not test the focus model even in principle. It stays
    open until a TV screen has a control on it.
  - **The 667 ms figure is an upper bound, not a latency.** The first
    screenshot to complete after `joinRoom` returned — 667 ms later — already
    showed `Milo`, but a single `screencap` round-trip is itself ~650 ms of
    that, and the clock started when the mutation returned rather than when a
    phone tapped Join. It bounds the TV's update inside the 1 s criterion
    without measuring it, so the Phase 1 caveat narrows rather than clears.

  One defect found, filed on the design fidelity pass above rather than fixed
  here: `"userInterfaceStyle": "light"` in `apps/tv/app.json` is a silent
  no-op on Android. `expo prebuild` says so outright — "userInterfaceStyle:
  Install expo-system-ui in your project to enable this feature" — and the
  consequence is visible at launch, where the window sits at the platform's
  default dark grey instead of the Boardwalk canvas until the fonts resolve
  and `TvLayout` stops returning `null`. On a television that is a black flash
  on every cold start.
- [x] Both apps open on the Boardwalk canvas (found on the Android emulator
  during the toolchain task above, and split out of the design fidelity pass
  so it is fixed once rather than noticed again on every screen) — AC:
  `expo-system-ui` is installed in both apps, so `userInterfaceStyle` is no
  longer a silent no-op on Android; each app's Expo config declares a window
  `backgroundColor` equal to the token its own root screen paints
  (`colors.screen` for the TV, `colors.canvas` for the Controller); unit tests
  tie those literals both to the Boardwalk palette and to the root screens, so
  the two cannot drift; and a cold start on the Android TV emulator shows the
  cream window rather than the platform's dark grey while the fonts resolve.

  Verified by capturing the same frame of the launch sequence before and after:
  the flat window that sits behind `TvLayout`'s `null` while the fonts resolve
  was `#2E2E2E` and is now `#F7F1E6`, and the pairing screen still renders
  after it. `prebuild` generates `activityBackground` into `colors.xml` and
  points `android:windowBackground` at it, which is the mechanism.

  Two things to be straight about. The Controller's half is config and unit
  tests only — that app has never been built for Android at all, so its
  `colors.canvas` window is asserted, not seen. And the fix addresses the
  window *behind* the React view; the very first frame is still the splash
  theme's own white, which is a separate treatment the design fidelity pass
  owns.
- [x] Sticker tilts render cleanly on tvOS — AC: the ±1–2° rotations Boardwalk
  puts on the code tiles, the badge and the QR card no longer leave stepped
  borders on Apple TV; a rotated edge shows continuously varying coverage row
  to row rather than holding one position and jumping.

  `CALayer.allowsEdgeAntialiasing` is false by default and a layer carrying a
  transform is composited without antialiasing, so every tilted card had a
  visibly stepped outline — Apple-only, because Android's RenderThread already
  antialiases transformed layers. Measured on tile 1's left border: before, 21
  consecutive rows reported the edge at exactly `x=213` at full ink and then
  jumped a pixel, with no intermediate values anywhere; after, coverage ramps
  every row (`27, 31, 39, 46, 54 … 145`), matching Android's profile.
  `ios.infoPlist.UIViewEdgeAntialiasing` turns it on app-wide; `expo config
  --type introspect` confirms prebuild emits the key. Apple documents a
  rendering cost, which does not matter on these near-static screens. Only the
  TV app needs it — nothing in the Controller is rotated.

  Found by eye first, and the pale hairline reported alongside it turned out to
  be a *different* bug on both platforms — see the task below.
- [x] Hard offset shadows leave a pale seam where they meet the border (both
  platforms, so not the tvOS antialiasing issue above) — AC: the junction
  between a card's ink border and its ink shadow is solid ink, with no lighter
  row between them.

  Measured at a tile's bottom border, scanning down: ink `27`, then one row at
  `83` on tvOS / `69` on Android, then ink `27` again — roughly a fifth of the
  background bleeding through a boundary that should be solid, on every bordered
  surface in the product. Unaffected by `UIViewEdgeAntialiasing`.

  The cause is on the surface itself, not in the shadow. A view that both fills
  and strokes paints its `backgroundColor` across the whole rounded rect and
  then strokes the border inside it; at the antialiased boundary the background
  out-covers the stroke, so a sub-pixel sliver of *fill* escapes outside the
  ink. The seam therefore takes the fill colour, which is the evidence: the
  white tiles leak white (`(84,84,81)` is 75% ink over white, not over cream)
  and the tangerine badge leaks orange (`(70,44,24)`). Predicting that the badge
  would leak orange before looking is what confirmed it.

  Three earlier diagnoses were wrong and should not be re-tried. (1) tvOS
  `allowsEdgeAntialiasing` — a real but separate bug, fixed in the task above,
  and it never touched this hairline. (2) An outset `box-shadow` being clipped
  to exclude the border box, leaving two coincident antialiased edges on one
  curve: drawing the shadow as an opaque sibling rect instead left the seam
  byte-identical at `84`. (3) The surface's outer edge blending with the screen:
  growing the shadow 1px under that edge also left it byte-identical. An earlier
  revision of this entry stated (2) as fact; it was not.

  The fix is `StickerSurface` (`@huddle/ui/native`), which every bordered
  surface in both apps now goes through — 3 on the TV, 6 on the Controller. It
  sets the surface's own background to the border colour, makes the border
  transparent while keeping its width so the content box does not move, and lays
  the fill in behind the content, leaving nothing lighter than ink able to
  escape past the edge. It also draws the shadow as a sibling rectangle, which
  is why `shadows.ts` now returns a rect rather than a `boxShadow` — kept
  because it is equivalent and keeps that module Node-testable, *not* because it
  fixes anything.

  Both platforms measured clean. On tvOS, an A/B on the Apple TV 4K simulator:
  the junction reads as one solid ink band, and temporarily restoring the old
  fill-and-stroke rendering puts the hairline back into the identical crop of
  the identical scene. On the Android TV emulator, scanning the pixels: down a
  tile's bottom border, 14 unbroken rows of ink `27` from fill to cream with no
  lighter row; across a tile's right border, the same; and down the tangerine
  badge, 11 unbroken rows with no orange escaping past the ink — the badge being
  the surface whose leak identified the cause.

  Two things this does *not* establish. The same A/B on Android did **not**
  reproduce the seam: with fill-and-stroke restored, the junction stayed solid.
  So Android confirms the fix is clean, not that it is what made it clean — the
  reproduction there probably needs the original `boxShadow` path, which no
  longer exists to restore. And the Controller's 6 converted surfaces have never
  been run on any device; they are converted, type-checked and unit-tested, and
  nothing more. Both are for the design fidelity pass to close.
Split on 2026-07-31, for the second time and for the same reason the Android
toolchain came out of it: three targets in one checkbox, each of which can
fail on its own and none of which can be reviewed against the other two.
Every one of these needs physical hardware in the room, so none can be closed
by an agent — they are the phase's human-only tasks.

- [ ] Real-device build — the Philips Android TV — AC: a locally built APK
  installs and runs on the Philips Android TV, and the pairing screen renders
  with a roster that still updates live. This is the real hub target and the
  one the Android emulator has been standing in for at a much higher API
  level, so expect the Boardwalk measurements, the font loading and the focus
  model to need re-checking here.
- [ ] Real-device build — an Android phone — AC: a locally built APK runs on
  an Android phone; it joins a room by code and by scanning the TV's QR with
  the phone's own camera, which is the one step of the QR task still untried
  on any hardware.
- [ ] Real-device build — iPhone and TestFlight — AC: the iOS Controller
  build runs via Xcode on a physical iPhone and is uploaded to TestFlight.
- [ ] Play-test gate — AC: one full game night on real hardware: 4+ players,
  at least two full trivia games (one flat, one speed), at least one forced
  disconnect/rejoin — completed without restarting any app or the backend;
  every issue found is filed as a task before MVP is called done.
