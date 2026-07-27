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
- **Open a room** — the TV-side act of getting the room for this launch:
  `createRoom` if none has been minted yet, otherwise the one already minted.
  `createRoom` (server) mints; `openRoom` (TV client) is create-exactly-once.
- **Lobby** — the pre-game phase of a room (roster visible, Host picking a
  game). A room is `lobby → in-game → lobby`.
- **Player** — a phone-holding participant in a room; session-only identity
  (nickname + claimed color), no account.
- **Nickname** — the name a player types when joining, and the room's name for
  them. Unique within a room ignoring case and surrounding spaces; `joinRoom`
  turns a repeat away with "name taken".
- **Roster** — a room's players as the clients draw them: the TV's seats, and
  (Phase 2) the Host's rows on their phone. Served in join order by the
  `roster` query, which projects each player rather than handing over the row.
- **Seat** — one place on the TV's roster: a dashed empty circle until a player
  takes it, then their avatar and nickname. A room has ten of them
  (`ROOM_PLAYER_CAP` in game-core, the plan's pinned cap); the pairing screen's
  footer always draws at least the handoff's four.
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
- **Status Dot** — the dot on a player's avatar saying whether the room is
  hearing from their phone: Boardwalk green when it is, muted when they are
  Away. Boardwalk's online dot (the handoff draws it on the Host's roster rows;
  the TV's pairing seats are specified as avatar and nickname only), carried
  onto every surface that lists players because presence is news wherever a
  player is drawn.
- **Game Module** — a self-contained game implementation behind the game-core
  interface (metadata, settings schema, reducer, TV/phone screens). Games are
  modules; the hub never contains game logic.
- **Registry** — the list of installed game modules the hub renders (carousel,
  metadata). Adding a game = adding a registry entry.
- **Settings Schema** — a game module's declaration of its host-tunable
  options; the hub renders settings UI generically from it.
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
