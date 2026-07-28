# Domain Model — Huddle

Living vocabulary for this project. Names in code mirror these terms.
Anyone (human or agent) who introduces or discovers a domain term while
working must add it here.

## Terms
- **Huddle** — the product: a native TV hub app for party games where every
  player's phone is their controller.
- **Room** — the shared session a TV creates and phones join; identified by a
  Room Code. Holds players, current game, and state. It is NOT called a
  "lobby" — the lobby is a phase of a room.
- **Room Code** — 4-letter (A–Z) code identifying a room, shown on the TV and
  encoded in its QR deep link (`huddle://join/<code>`). Minted server-side by
  `createRoom`, which redraws until the code is held by no live room; an
  expired room's code returns to the pool.
- **Join Link** — the `huddle://join/<code>` deep link that puts a phone into a
  room. The TV's QR encodes it; both apps register its scheme (`huddle`).
  Built by `roomJoinLink` in game-core, because it is protocol both sides share.
- **Pairing Screen** — the TV screen an empty room shows: the Room Code in four
  letter tiles, the QR of its Join Link, and the waiting roster. The TV app's
  first screen on launch, and where a room returns when it empties.
- **Stage** — the TV app's fixed 1280×720 design surface (`TvStage`), scaled to
  whatever panel it runs on, so every measurement in TV screens is written
  exactly as the design handoff gives it. Distinct from the metaphorical "stage"
  in Eyes up below.
- **Join Screen** — the Controller's first screen: four Room Code cells that
  fill one letter at a time, a nickname field, and Join. Where a phone becomes
  a Player. Its "You're in" state is the same screen once the room has seated
  them — the Controller's half of what the Pairing Screen is on the TV.
- **Join Rejection** — why `joinRoom` refused a phone: `roomNotFound`,
  `roomFull`, `nameTaken`, or `nameUnusable`. A discriminated union in
  game-core (protocol both sides share, like the Join Link), thrown as the
  `data` of a `ConvexError` because that is the only part of a thrown error
  Convex does not redact. The Join Screen picks its copy by `kind`, never by
  matching the message text.
- **Open a room** — the TV-side act of getting the room to show:
  `createRoom` if none has been minted yet, otherwise the one already minted.
  `createRoom` (server) mints; `openRoom` (TV client) is create-exactly-once —
  once per room rather than once per launch, since a television outlives the
  rooms it shows (see Room Expiry).
  Opening can fail, and nobody can help it: the TV app is untouched after
  launch, so `keepOpeningRoom` retries with backoff for as long as the
  television is on and never gives up. What it is doing meanwhile is the
  **Room Opening** — `opening`, `reconnecting`, `open`, or `misconfigured`
  (this build was given no `EXPO_PUBLIC_CONVEX_URL`, so there is nothing to
  retry against). `reconnecting` and `misconfigured` are what the pairing
  screen's status chip says; the other two carry its ordinary invitation.
- **Lobby** — the pre-game phase of a room (roster visible, Host picking a
  game). A room is `lobby → in-game → lobby`.
- **Room Phase** — which of those two a room is in (`ROOM_PHASES`). It is not a
  stored field: a room holding a Running Game is `in-game` and a room holding
  none is in its `lobby`, so the phase is read off the game (`roomPhase`). One
  fact written once — there is no such row as an in-game room with nothing
  running.
- **Running Game** — what a room in a game holds: the `gameId` of the installed
  module and the game's own `state`, which the hub stores and returns without
  ever reading. Absent on a room in its lobby.
- **Game Lifecycle** — the two Host-only writes that move a room between its
  phases: `startGame` (seeds the state from the module's initial-state factory)
  and `endGame` (clears it, leaving roster, Host and Room Code untouched).
  Starting is refused over a running game, and refused for a party smaller than
  the game's `playerRange.min`; ending is unconditional, because "End game" is a
  button a thumb can hit twice and the second tap asks for the lobby the room is
  already in. A room too *large* for a game is not refused — Huddle cannot
  remove a player, so that belongs in the Host's picker, where there is still
  something to be done about it.
- **Carousel** — the TV's game browser (handoff §6): the focused card with its
  neighbours either side. It draws whatever `browsingGameIndex` names, so the
  television follows the room rather than any one phone.
- **Browsing Game Index** — the room's position in the Registry's ordered list,
  which the Host's arrows move and the TV and every other phone follow. An index
  and not a game id, because browsing is a walk along an ordered list: "the third
  card" has to mean the same thing on every screen. Clamped to what the build
  installs (`browsingIndex`) rather than refused, since the list differs between
  builds.
- **Game Stage** — the part of a client's screen a running game draws in: the
  whole TV under the header, and the phone under its own. The frame around it is
  the hub's and says only what Game Metadata already told it, so neither client
  knows which game it is showing.
- **Unknown Game** — a client in a room playing a game that client's build does
  not install (`runningGameScreen`). Drawn as its own screen rather than as the
  lobby, because a lobby would invite a player to act on a room that is mid-game.
  Reachable whenever a phone or a TV is behind the rest of the room.
- **Player** — a phone-holding participant in a room; session-only identity
  (nickname + claimed color), no account.
- **Nickname** — the name a player types when joining, and the room's name for
  them. Unique within a room ignoring case and surrounding spaces; `joinRoom`
  turns a repeat away with "name taken".
- **Roster** — a room's players as the clients draw them: the TV's seats, and
  (Phase 2) the Host's rows on their phone. Served in join order by the
  `roster` query, which projects each player rather than handing over the row.
- **Seat** — one place on the TV's roster: a dashed empty circle until a player
  takes it, then their claimed color with their Bungee initials, and the
  nickname under it. A room has ten of them (`ROOM_PLAYER_CAP` in game-core, the
  plan's pinned cap); the pairing screen's footer always draws at least the
  handoff's four. Because the circle's fill is now the player, everything else
  a seat has to say rides its Offset Shadow — punch for Just Joined, tangerine
  for the Host — which is the one channel none of the ten fills can collide
  with. Both stand in for pills the §3 lobby card will draw properly.
- **Host** — the player with room-control privileges (pick game, settings,
  start/skip/end). First to join; auto-transfers to the longest-connected
  active player on disconnect. Plays games like any other player. Held as the
  room's `hostPlayerId` rather than a flag on a player, so a room has exactly
  one by construction. "Disconnect" is the room's only signal for it — the Host
  going Away — and "longest-connected" is join order, so a player who dropped
  out and came back keeps the place they always had. A room whose players have
  all gone quiet keeps its away Host: being away is not resigning.
- **Controller** — the phone app. Not "remote".
- **TV app** — the hub client on the television; a pure renderer of room
  state; holds no player record; untouched after launch.
- **Session Token** — random token stored on the phone that identifies a
  player for rejoining; the entirety of Huddle's "auth". Minted by `joinRoom`
  (`generateSessionToken` in game-core), returned to that one phone, and kept
  in the device keystore. Never on the Roster: the `roster` projection is what
  keeps it off the TV.
- **Rejoin** — a phone returning to the seat it already holds, by presenting
  its Session Token; the `session` query answers with that seat or with
  nothing. It is a read, not a join: force-quitting does not give up a seat, so
  a rejoining player is never a second player row and the roster never grows a
  duplicate. The Controller rejoins before it will show anyone a Join Screen —
  the one exception being a Join Link scanned for a *different* room, which is
  a player who has walked to another TV and is let through to the form.
- **Heartbeat** — the "still here" a seated Controller sends every
  `HEARTBEAT_INTERVAL_MS` while it is in the foreground, identified by the
  Session Token (`players.heartbeat`). Stopping is how a phone says it is gone:
  the room has no other signal, so backgrounding, a force-quit and a dropped
  network are one event to it. The interval and the Away deadline are pinned
  together in game-core's `presence.ts`, because neither means anything alone.
- **Away** — presence state of a player the room has stopped hearing from.
  Set by the room's own scheduled check (`markAway`) once `AWAY_AFTER_MS` has
  passed since that player's last Heartbeat, and cleared by the next one. An
  away player keeps their seat, their score and their Session Token; games
  never wait for them.
- **Deserted** — a room whose every player is Away: the room's own reading of
  "everybody has left", and the only one available to it, since going quiet is
  all it ever learns about a phone. Noticed inside `markAway`, because the last
  check to mark a player away is the one that completes it.
- **Room Expiry** — a Deserted room being deleted, with its players, once
  `ROOM_EXPIRY_MS` (10 minutes, the plan's pinned default) has passed since the
  last Heartbeat the room heard from anybody. A scheduled write (`expireRoom`)
  for the reason Away is one: a query re-runs when rows change, not when time
  passes. A Heartbeat inside the ten minutes saves the room without cancelling
  anything — the check re-reads the clock when it runs and leaves a room that
  has been rejoined standing. A room nobody has joined never expires: nobody
  left it, and its Room Code is on a screen somebody may be reading. Expiry is
  what returns a Room Code to the pool, and what sends a phone whose party
  ended back to the Join Screen, since its Session Token then answers nothing.
  The TV learns of it from the `stillOpen` subscription and opens a fresh room
  (`closeExpiredRoom`) rather than showing a code that belongs to no room.
- **Status Dot** — the dot on a player's avatar saying whether the room is
  hearing from their phone: Boardwalk green when it is, muted when they are
  Away. Boardwalk's online dot (the handoff draws it on the Host's roster rows;
  the TV's pairing seats are specified as avatar and nickname only), carried
  onto every surface that lists players because presence is news wherever a
  player is drawn.
- **Just Joined** — the pink treatment a Seat wears for about four seconds after
  its player appears (the handoff's avatar pop-in), then settles. A fact about
  what one screen has watched, not about the room: the TV works it out by
  comparing the roster snapshots it has been pushed, since the room does not
  record when a seat was taken and a server timestamp would be read against a
  television's own clock. Seats already taken when a screen starts watching are
  greeted by nobody. Distinct from an **Arrival** (`noteArrivals`, `isArrival`),
  which is the permanent fact that this screen watched the seat being taken;
  Just Joined is the four seconds that fact earns, counted by the seat itself.
- **Game Module** — a self-contained game implementation behind the game-core
  interface (`GameModule`: metadata, settings schema, initial-state factory,
  reducer, TV/Controller screens). Games are modules; the hub never contains
  game logic. Its state, event and settings types are its own, and the hub
  holds all three opaquely — which is why the interface's members that touch
  them are declared as methods, so a `GameModule<TriviaState, …>` sits in a
  list of `GameModule<unknown, …>`.
- **Game Logic** — a module without its screens (`GameLogic`: metadata,
  settings schema, initial-state factory, reducer). The half that runs inside a
  Convex mutation, and the reason a module is split: screens are properties of
  an object and do not tree-shake, so a server importing whole modules would
  bundle the React Native of every installed game. The Registry ships both
  views through separate entry points — `@huddle/game-registry` for the
  clients, `@huddle/game-registry/logic` for the server — and they are the same
  objects, not copies.
- **Game Metadata** — everything the hub can say about a game without playing
  it, and the whole of its carousel card: id (what a room stores when a game is
  picked), title, Key Art, player range, estimated minutes, and the genre
  category chip. A game's category is not a Question Pack's category.
- **Key Art** — a Game Module's card face: a flat block of Boardwalk color with
  its Bungee title on it, and the only say a module has over how it is drawn.
  game-core names the five colors it may wear (`KEY_ART_COLOR_NAMES`, the
  Boardwalk accents), `packages/ui` holds their values — the split the Player
  Palette already uses.
- **Game Event** — what a player did, as the Reducer receives it. Its shape is
  the module's own but every one of them names the player it came from
  (`GameEvent`), because that is the one thing the hub can settle generically:
  a Controller presents its Session Token and the room turns it into a player.
  A phone naming itself is a claim, never an identification.
- **Registry** — the list of installed game modules the hub renders (carousel,
  metadata), held in order because the carousel browses it by index. Adding a
  game = adding a registry entry. It is `packages/game-registry` and not part
  of game-core because every module depends on the interface, so the list of
  modules cannot sit beside it without a cycle. The only place in Huddle that
  names a game.
- **Settings Schema** — a game module's declaration of its host-tunable
  options; the hub renders settings UI generically from it. Each option is a
  labelled key with a closed list of labelled values and a default among them,
  which is what every setting Huddle has scoped is and what a generic screen
  can draw without the game telling it how.
- **Reducer** — a game module's pure `reduce(state, event)` rules function;
  runs server-side in Convex mutations.
- **Question Pack** — versioned data file of trivia questions (text, 4
  options, correctIndex, category, difficulty). The only way trivia gets
  content; every future source emits packs. Not "quiz".
- **Reveal** — the post-question moment showing the correct option and who
  scored, followed by the running scoreboard.
- **Scoring Mode** — trivia setting: `flat` (100 per correct answer, default)
  or `speed` (`100 + round(100 × secondsRemaining / 20)`).
- **Victory Screen** — end-of-game final standings on the TV; ties share the
  top rank.
- **Color Claim** — a player's server-validated selection of a unique color
  swatch; their avatar is that color with their initials. Unique within a room
  and first-to-ask-wins, like a Nickname; tapping a second swatch moves a player
  rather than adding one, and frees the first. A player has no color until they
  pick one — the picker is the screen they land on.
- **Player Palette** — the ten claimable colors: Boardwalk's five accents plus
  five more around the hue wheel. game-core names them (`PLAYER_COLOR_NAMES`)
  because a name is protocol; `packages/ui` says what each looks like, because a
  value is Boardwalk's. Ten because a room seats ten. Each carries the ink its
  Bungee initials are set in — one text color cannot read on all ten.
- **Color Rejection** — why `claimColor` refused a swatch: `colorTaken`,
  `colorUnknown`, or `notInRoom`. The Join Rejection's shape and thrown the same
  way, so the picker tells them apart by `kind`.
- **Boardwalk** — Huddle's design system (docs/design/design-handoff.md):
  cream canvas, ink borders, hard offset shadows, sticker rotations, Bungee +
  Space Grotesk. Implemented as `packages/ui`, the only place a color may be
  written down.
- **Offset Shadow** — Boardwalk's signature drop shadow: hard-edged and never
  blurred (`Npx Npx 0 <color>`), ink by default and an accent color for
  highlights. Always produced by `offsetShadow()` in `packages/ui`; never
  `elevation` and never a blur.
- **Color tokens** — Boardwalk names its palette by role, and code uses those
  names, never a generic color word: `canvas`, `screen`, `surface`, `ink`,
  `mutedText`, `mutedBorder`, `cobalt`, `tangerine`, `punch`, `green`,
  `yellow`.
- **Eyes up** — the platform's core UX principle: the TV is the stage; phones
  are minimal controllers; players' eyes belong on the TV and each other.

## Naming Decisions
- We say "Room", never "Lobby" for the entity; "lobby" is only the pre-game
  phase.
- We say "Controller" for the phone app, never "remote".
- We say "Question Pack" (or "pack"), never "quiz" or "question set".
- We say "Host", never "admin", "owner", or "leader".
- We say "away", never "offline" or "AFK".
- We say "Game Module" for the code unit; "game" alone means the thing being
  played.
