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
- [ ] Lobby settings UI (the other half of the split) — AC: the Host phone
  renders the settings controls generically from whatever schema the chosen
  game declares — nothing in the renderer names trivia or any of its
  settings; a non-Host phone never sees settings controls; changing a
  control updates what the room will start with, and every phone's carousel
  keeps working while the Host is choosing.
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
- [ ] A Room Code tile sometimes draws empty on tvOS — AC: reproduce a blank
  tile deliberately, then prove the fix by an A/B of the identical crop rather
  than by one screenshot that looks right. **Do not act on the "letter I"
  theory below — it was tested and is wrong.**

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
  has now been disproven.
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
