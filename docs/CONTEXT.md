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
  encoded in its QR deep link (`huddle://join/<code>`).
- **Lobby** — the pre-game phase of a room (roster visible, Host picking a
  game). A room is `lobby → in-game → lobby`.
- **Player** — a phone-holding participant in a room; session-only identity
  (nickname + claimed color), no account.
- **Host** — the player with room-control privileges (pick game, settings,
  start/skip/end). First to join; auto-transfers to the longest-connected
  active player on disconnect. Plays games like any other player.
- **Controller** — the phone app. Not "remote".
- **TV app** — the hub client on the television; a pure renderer of room
  state; holds no player record; untouched after launch.
- **Session Token** — random token stored on the phone that identifies a
  player for rejoining; the entirety of Huddle's "auth".
- **Away** — presence state of a player whose phone is disconnected or
  backgrounded; games never wait for away players.
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
  swatch; their avatar is that color with their initials.
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
