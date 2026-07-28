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

  A room nobody has ever joined never expires: nobody left it, and its Room Code
  is on a television somebody may be reading across the room, so taking it away
  is the one thing expiry must not do. The consequence is that never-joined rooms
  accumulate — the dev deployment holds about twenty-five from past TV launches —
  which is flagged rather than fixed, because every fix for it is a fix that can
  delete a code off a working screen.

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
- [ ] TV and phones follow the room into the game (client half of the split) —
  AC: Host selects trivia and starts → TV and all phones switch to trivia
  screens within 1s; Host "End game" mid-game → everyone returns to the lobby,
  room intact; both clients mount the module's screens out of the Registry
  without naming a game.
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
- [ ] Real-device builds — AC: locally built APK installs and runs on the
  Philips Android TV; locally built APK runs on an Android phone; iOS
  controller build runs via Xcode on a physical iPhone and is uploaded to
  TestFlight.
- [ ] Play-test gate — AC: one full game night on real hardware: 4+ players,
  at least two full trivia games (one flat, one speed), at least one forced
  disconnect/rejoin — completed without restarting any app or the backend;
  every issue found is filed as a task before MVP is called done.
