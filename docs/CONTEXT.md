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
- **Room Code** — 4-letter code identifying a room, shown on the TV and
  encoded in its QR deep link (`huddle://join/<code>`). Minted server-side by
  `createRoom`, which redraws until the code is held by no live room; an
  expired room's code returns to the pool. It is minted from A–Z *without I*
  (`ROOM_CODE_MINT_ALPHABET`) — a mitigation for a tvOS tile that drew an I
  blank, which has outlived the bug: the tile itself is fixed (Code Letter Box),
  so the narrower alphabet is now a spare belt rather than the only one, and
  taking I back is its own decision. A code may still be *read* as
  any of A–Z (`ROOM_CODE_ACCEPTED_ALPHABET`), because rooms minted before the I
  came out are still live and still have to be typeable off a television.
- **Join Link** — the `huddle://join/<code>` deep link that puts a phone into a
  room. The TV's QR encodes it; both apps register its scheme (`huddle`).
  Built by `roomJoinLink` in game-core, because it is protocol both sides share.
- **Pairing Screen** — the TV screen an empty room shows: the Room Code in four
  letter tiles, the QR of its Join Link, and the waiting roster. The TV app's
  first screen on launch, and where a room returns when it empties.
- **Stage** — the TV app's fixed 1280×720 design surface (`TvStage`), scaled to
  whatever panel it runs on, so every measurement in TV screens is written
  exactly as the design handoff gives it. Distinct from the metaphorical "stage"
  in Eyes up below. It is also where the About Panel is mounted, which is what
  puts that panel on every TV screen without any of them drawing it.
- **Remote Surface** — everything on the television a remote can reach, which is
  deliberately almost nothing: no TV screen holds a focusable view, so the
  remote's directions and its OK button have nothing to land on. The whole
  surface is one key — see About Panel. Enforced by `huddle/tv-remote-surface`,
  which fails a focusable component, a focus or press prop, or a remote listener
  written outside the one file the config names. "Requires zero remote
  interaction" and "one remote-reachable control" are two claims about two
  mechanisms — focus and a root key listener — and both are true at once.
- **About Panel** — the TV's one remote-reachable control: a Boardwalk card
  summoned by the remote's play/pause key, showing this build's Build Stamp. It
  closes on the next press of anything — OK included, deliberately — and on its
  own after twenty seconds; the auto-dismiss is what keeps Eyes up true, since a
  panel needing a second press to dismiss is a state a guest can leave the room
  in. Play/pause because a television running a party is not playing media, so
  it is the button nobody presses by accident, and because the app binds it to
  nothing else. **Not** because it is the only key that arrives: both platforms
  deliver the directions and OK to the root view with nothing focused, and the
  app simply answers one of them.
- **Build Stamp** — what identifies the build a party is actually running, and
  the whole content of the About Panel: version (marked when it is a debug
  bundle), the Convex deployment as a host, and the installed Game Modules.
  Version alone is not it — the questions a room asks are which deployment its
  rooms live on and which games this television can draw.
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
  the game's `playerRange.min`; ending is unconditional, because Back to lobby
  is a button a thumb can hit twice and the second tap asks for the lobby the
  room is already in. A room too *large* for a game is not refused — Huddle cannot
  remove a player, so that belongs in the Host's picker, where there is still
  something to be done about it.
- **Back to lobby** — the Host's control on their phone while a game runs, and
  the whole of the Game Lifecycle's `endGame` from the room's side: the room
  returns to its lobby with the same Roster — every player, their Nickname and
  their Color Claim — while the game's own state, the scoreboard included, is
  left behind, because that state is the only place it ever was. One label on
  every beat of every game rather than "End game" while playing and something
  else on the Victory Screen: the hub never reads a game's state, so the phone
  cannot know which beat the room is on, and "End game" is false on the beat
  after a game has ended where this is true on all of them. Offered on every
  screen a Host can be in-game on, the Unknown Game one included — a Host with
  no way back is a room with no way back, and a room stalled on a Reveal every
  phone has stopped counting has no other.
- **Carousel** — the TV's game browser (handoff §6): the focused card with its
  neighbours either side. It draws whatever `browsingGameIndex` names, so the
  television follows the room rather than any one phone.
- **Carousel Footer Line** — the one sentence under the Carousel's page dots
  (`carouselFooterLine`). §6 writes it as "<Host> is browsing on their phone",
  and it is a *slot* rather than that sentence: for four seconds after a phone
  lands it belongs to the newest Arrival ("<Nickname> just joined!", in punch),
  then it goes back. That is where the handoff's JUST JOINED! pill ended up,
  because the Carousel replaces the Pairing Screen at the first join and so has
  no Seat to put one on — and as a line rather than a pill because a Boardwalk
  pill's box would push the page dots back into the focused card's Offset
  Shadow. The HOST and away pills are *not* here: the line already names the
  Host, and the away pill is dropped outright — which means that between games
  the television says nothing at all about a non-Host player being away, since
  the Seat treatments that used to say it are unreachable once anybody is in
  the room; the Host Roster is where that went instead. A greeting is spent
  once and remembered by the screen, so a game
  ending does not re-announce the arrival that preceded it; and because the
  slot holds one sentence, two phones landing inside a single roster push greet
  only the later of them.
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
  the Host Roster on their phone. Served in join order by the `roster` query,
  which projects each player rather than handing over the row.
- **Host Roster** — the Roster as the Host's own phone draws it (handoff §5):
  one row per player in join order, each carrying their avatar, their Nickname,
  and a right slot that says exactly one thing about them — the HOST pill, or
  their Status Dot. A *section* of the Host's lobby screen rather than a screen
  of its own, since that phone already holds §4's and §7's, drawn directly
  under §4's heading and above its color picker: a color is claimed once while
  the roster is re-read all through a lobby, and a section the Host has to
  scroll to is a section a party does not read. Even there it does not fit every
  room — from the seventh player a row falls below the fold on a 402×874 phone,
  which is measured against the task rather than assumed away. Its footer line
  ("<n> players in — you can start anytime") drops the invitation on a room too
  small for the game being browsed, rather than contradict the start control
  further down the screen.
  It is the only surface in Huddle that says a non-Host player is Away between
  games: the TV's Seats said it until the Carousel took their screen, and the
  Carousel Footer Line dropped it outright. That is why it exists, and it is
  what decides the slot — the HOST pill wins over away-ness, which costs
  nothing, because this roster is drawn on the Host's phone alone and the row
  marked Host is the reader's own. The handoff's pink NEW! pill is the one pin
  not drawn: an Arrival is already greeted on the television for the same four
  seconds. Host-only, like §5 — a non-Host player still learns nothing about
  anybody else's presence between games, which is accepted rather than solved.
- **Seat** — one place on the TV's roster: a dashed empty circle until a player
  takes it, then their claimed color with their Bungee initials, and the
  nickname under it. A room has ten of them (`ROOM_PLAYER_CAP` in game-core, the
  plan's pinned cap); the pairing screen's footer always draws at least the
  handoff's four. Because the circle's fill is now the player, everything else
  a seat has to say rides its Offset Shadow — punch for Just Joined, tangerine
  for the Host — which is the one channel none of the ten fills can collide
  with. Neither stands in for anything any more: the §3 lobby card that was to
  draw them as pills is never coming, and the HOST pill and the away pill are
  now decided against the television outright (see Carousel Footer Line, which
  is where the third of them went).
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
  never wait for them. In a running game that means the beat's denominator —
  trivia's "3/5 answered" — counts everyone the room is still hearing from plus
  anyone whose answer is already in, so a phone going quiet never subtracts an
  answer the room has, and a phone coming back counts itself in by answering.
  Being away is never a bar to acting: a player who returns mid-question may
  answer it while its timer runs. A room where nobody is counted — every phone
  away, nothing answered — waits out its Game Deadline rather than ending the
  beat, since "everybody has answered" is vacuously true of nobody.
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
- **Status Dot** — the dot beside a player saying whether the room is hearing
  from their phone: Boardwalk green when it is, muted when they are Away.
  Boardwalk's online dot, which the handoff draws on the Host Roster's rows and
  which is drawn there; the TV's pairing Seats specify avatar and nickname only
  and carry it anyway, because presence is news wherever a player is drawn.
  Colour is the whole of the difference between its two states, so any surface
  drawing one owes a screen reader the word as well (`rosterRowSpokenAs`).
- **Just Joined** — the pink treatment a Seat wears for about four seconds after
  its player appears (the handoff's avatar pop-in), then settles. A fact about
  what one screen has watched, not about the room: the TV works it out by
  comparing the roster snapshots it has been pushed, since the room does not
  record when a seat was taken and a server timestamp would be read against a
  television's own clock. Seats already taken when a screen starts watching are
  greeted by nobody. Distinct from an **Arrival** (`noteArrivals`, `isArrival`),
  which is the permanent fact that this screen watched the seat being taken;
  Just Joined is the four seconds that fact earns, counted by the seat itself.
  A seat is not the only thing that spends them: the Carousel Footer Line spends
  the same four on the newest Arrival, counted the same way, because after the
  first join the television has no seats left to draw.
- **Pop-in** — the spring an arrival is announced with: scale 0.6 → 1 with a
  slight overshoot over about 300ms (`motionDuration.popIn`, `popIn`), the
  handoff's "avatar pop-in". It runs on the Carousel Footer Line's greeting and
  nowhere else, because that line is what inherited the announcement when §3's
  lobby card was dropped — the Seat the handoff's card became is unreachable
  once anybody is in the room, and a spring there would run for nobody. So a
  party sees a sentence spring in, not an avatar. The four seconds it introduces
  are Just Joined's and are counted separately: the spring is how the greeting
  arrives, not how long it stays.
- **Card Transition** — the carousel sliding into place behind a Browsing Game
  Index the room has moved: the cards start 96 design points off in the
  direction the room browsed and ease out to 0 over 250ms
  (`motionDuration.cardTransition`, `cardEntryOffset`). Transform only, so it
  moves nothing the layout can see — the page dots' 10pt of daylight under the
  focused card's shadow is a measured number that no animation may spend. A
  build installing one game cannot show it, since a list of one has nowhere to
  browse to.
- **Motion tokens** — Boardwalk's two animation durations and the pop-in's shape
  (`packages/ui/src/motion.ts`), read from the theme like a color and never
  written at the call site. `boardwalk/tokens-only` does not cover them — that
  rule reads the property names of a style object, and a duration is an argument
  to an animation — so this one is a convention the tokens hold rather than a
  gate. `springOf` is what makes a duration usable: React Native's spring takes
  stiffness, damping and mass, so the token names the spring's natural *period*
  and the conversion is the standard second-order one.
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
  A phone naming itself is a claim, never an identification. The player is
  *absent* on one kind of event only — a Game Deadline reaching the room, which
  nobody sent. No phone can produce that absence, since the hub writes the field
  over whatever arrives, so it always means the room itself.
- **Game Deadline** — what a Game Module does when nobody does anything, and how
  long the room waits first (`GameDeadline`, `GameLogic.deadline`): a Game Event
  to raise, the milliseconds to wait, and the name of the **beat** being timed.
  A reducer has no clock, so a beat that must end by itself cannot end from
  inside `reduce`; the module declares the deadline and the hub schedules it,
  which is how a countdown runs in a hub that does not know what a question is.
  The beat name is the only part the hub reads: two deadlines naming the same
  beat are one deadline, so the room arms it on *entering* that beat and not
  again — a clock re-armed on every event would be a beat that never ended while
  anybody was still acting on it. Optional: a game where nothing expires
  declares none.
- **Time Left** — how much of the room's clock the beat still had when an event
  reached the rules (`msRemaining` on `GameEvent`). The hub's, and written over
  whatever arrived exactly as the player is, because a phone claiming to have
  been faster than it was is a claim and never an identification. It is the
  whole of how a game can pay for answering quickly without a Reducer ever
  reading a clock: the room stores when its Game Deadline comes due
  (`deadlineAt`, wound and cleared with the deadline itself) and subtracts.
  Absent means the room could not say — a beat with no deadline on it, the
  deadline itself (a clock that has run out has nothing left of it), or a beat
  dealt by a deployment older than the field — and what nothing is worth is the
  game's judgement, never the hub's.
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
  can draw without the game telling it how. The hub also *settles* a Host's
  choices against it without reading them (`settingsFrom`, `settingsRefusal` in
  game-core): anything the schema does not offer is refused at `startGame` as a
  `settingRejected`, and anything the Host left alone takes the schema's own
  default — so a game is never handed a setting it did not declare, and a Host
  who never opened the settings screen still starts a game that has settings.
  What crosses the hub is `GameSettings`, a value per key and both of them
  strings; a game's own settings type is its business, on the far side of that.
- **Settings Choice** — what the Host has picked on the settings controls, held
  on the Host's phone alone (`settings-choice` in the Controller) and tagged
  with the game it was picked for, so browsing to another card leaves it behind
  rather than sending one game's setting to another's schema. It is not room
  state, unlike `browsingGameIndex`: the carousel is a surface three screens
  read, and a phone that is not running the room has no settings to draw at all.
  It reaches the room only as the `settings` argument of the Host-only
  `startGame`, which is what actually keeps a non-Host from setting anything.
  It lasts as long as the phone's seat does, not as long as the lobby: a party
  playing twice in an evening comes back from a game to the settings they
  chose, and only relaunching or browsing to another card clears them.
- **Reducer** — a game module's pure `reduce(state, event)` rules function;
  runs server-side in Convex mutations.
- **Question Pack** — versioned data file of trivia questions (text, 4
  options, correctIndex, category, difficulty). The only way trivia gets
  content; every future source emits packs. Not "quiz". A pack is a `.json`
  file in `packages/packs/packs/` holding an `id` (a lowercase slug, which is
  also its file name), a `title`, a `version` and its questions, and it is
  `questionPackSchema` — one Zod schema — that says so: the format validates
  and types from the same declaration, so `QuestionPack` cannot grow a field
  that nothing checks.
- **Pack Question** — one question as a pack holds it (`PackQuestion`): what
  the rules need to ask it, plus the two fields only a pack has a use for. Its
  **category** is free text with one word reserved (`RESERVED_CATEGORY`, `all`,
  in any case): the Host's filter is built from whatever categories a pack
  happens to use, and it needs a value meaning "no filter", so a pack claiming
  that word is malformed rather than merely awkward — the two share one space
  and only one of them can have it. Its **difficulty** is `easy`, `medium` or
  `hard`, which is an author's sorting aid and nothing the rules read. A game's
  category (Game Metadata) is not one of these.
- **Curated Pack** — the pack that ships in the repo (`CURATED_PACK`,
  `huddle-classics`): 120 questions across six categories, 20 apiece, so that
  the longest game trivia offers never repeats itself even inside one filtered
  category. Its answers sit in all four positions on purpose — a pack answered
  "always the first button" is one a player can win without reading it.
- **Pack Validation** — `pnpm validate:packs`: the Question Pack schema pointed
  at a directory of pack files, and a CI gate. It exists because a pack is
  hand-written data, which no amount of typechecking sees. It reports every
  problem in every pack rather than stopping at the first, and exits non-zero
  if a file is malformed, unparseable, or if the directory holds no packs at
  all — a mistyped path that validated nothing would otherwise read as a pass.
- **Question Deal** — how a game of trivia gets its questions from the Curated
  Pack (`questionsFor`): the Host's category filter, then their count, taken off
  the front of what is left. Dealt once, into the state, so a room is asked what
  it was dealt at the moment it started. Two decisions ride in it. The pack is
  written a category at a time, so a deal for *all* categories takes one from
  each in turn and the shortest game still spans the pack; a deal for one
  category is that pack's own order, because there is a single queue to take
  from. And it is **deterministic** — no shuffle, no random number — because a
  module is a pure function of what it is handed and `GameSetup` has nowhere for
  the hub to hand it a seed. The flat cost is that a party playing twice in an
  evening is asked the same questions in the same order. A count larger than the
  category holds deals what there is: a short game, never a repeat.
  (`INLINE_QUESTIONS`, the three questions written into the module before packs
  existed, is what this replaced.)
- **Reveal** — the post-question moment showing the correct option and who
  scored, followed by the running scoreboard. One of trivia's three phases
  (`question`, `reveal`, `finished`), which is where a game of it is.
- **Advance** — trivia's "the room moves on from what is on screen": it ends a
  reveal, or ends a question the room has stopped waiting on (whoever has not
  answered scores what a wrong answer scores). A Game Event like an answer,
  because a reducer has no clock — the Question Timer is what sends it
  unprompted. Addressed to the beat it ends (the question *and* the phase), the
  way an answer is addressed to its question: nothing owns the signal, so every
  source of it races every other, and a bare "move on" arriving a beat late
  would reveal a question the room has not read yet and cost it the scores from
  it. Named that way, the second of two thumbs a beat apart does nothing.
- **Standings** — trivia's scoreboard as its state holds it: one row per player,
  highest score first, ties left in the order they already had. Ordered once in
  the rules rather than on each screen, so the running scoreboard, the Victory
  Screen and the finished state cannot disagree about who is winning. It is also
  who is playing: every player has a row from the first question.
- **Answer Screen** — what a phone shows during a game of trivia: the question's
  four options as buttons, or, on any beat with nothing to press, a line sending
  the room's Eyes up to the television. Derived from the room's state and
  nothing else (`answerScreen`) — a phone remembers no tap of its own, so what
  it draws is always what the room says rather than what that phone hopes it
  said. It offers only taps the rules would accept, which is what leaves the
  reducer's refusals a floor nobody stands on.
- **Locked In** — a player's answer is in and cannot be changed. The reducer
  takes the first answer per player per question and refuses the rest, so this
  is one state with three guards behind it: the button stops being pressable,
  the rules refuse a second answer, and the hub does not overwrite one on its
  way past.
- **Watched Screen** — the Answer Screen's counterpart on the television: what
  the TV draws during a game of trivia (`watchedScreen`) — the question with its
  four options and the "3/5 answered" count, the Reveal with the correct option
  and a Verdict per player, or the final scoreboard. Derived from the room's
  state and its roster, which is the whole of what a TV screen is given: the
  television holds no player record and sends nothing.
- **Verdict** — whether one player got the question just revealed right. False
  for a wrong answer *and* for no answer, which score the same, so the mark on
  screen can never disagree with the score it produced.
- **Reveal Beat** — the five seconds a Reveal stays up, and the `advance` that
  ends it (`revealBeat`, `REVEAL_SECONDS`). It comes from the phones because it
  cannot come from the television, and from *every* playing phone rather than a
  nominated one: the event is addressed to the beat it ends, so the first to
  arrive moves the room and the rest do nothing. One nominated phone would be
  one phone whose screen locking stalls the room. Still the phones' clock, and
  the last one: the Question Timer moved the other beat to the room.
- **Question Timer** — the twenty seconds a question stays up, and the `advance`
  that ends it (`questionTimer`, `QUESTION_SECONDS`). Trivia's Game Deadline, so
  unlike the Reveal Beat it is the *room's* clock: the hub schedules it, and it
  therefore fires for a room whose every phone is face-down on a table. Whoever
  has not answered when it does scores what a wrong answer scores, because the
  Reveal never asks how a question ended, only what was answered before it did.
  It races the last player's answer and neither has to know: both are an
  `advance` addressed to the beat they end, so whichever arrives first reveals
  the question and the other lands on a beat that no longer matches. It names no
  player — nobody sent it.
- **Countdown** — the Question Timer as the television draws it: a number
  counting the rule's seconds down, started when that screen was handed the
  question rather than against a deadline in the state. The room's clock is the
  server's, and a TV counting towards a server timestamp would be counting on
  its own clock, which nothing holds in step (the reason a Seat's Just Joined is
  worked out the way it is). Counting from the question arriving starts a round
  trip late, which is the safe direction — the reveal takes the number off the
  screen, rather than the number sitting at zero waiting for it.
- **Scoring Mode** — trivia setting: `flat` (100 per correct answer, default) or
  `speed` (`100 + round(100 × secondsRemaining / 20)`, so the fastest possible
  correct answer is worth twice a flat one and the slowest exactly as much). A
  wrong answer and an answer that never came score nothing in either mode, which
  is what keeps a Verdict from ever sitting beside points. The seconds are the
  Time Left the hub timed that answer with, held to the question's own twenty at
  both ends and kept beside the answers (`answerSeconds`) until the Reveal
  prices them — pricing at the tap would move a score before the reveal and tell
  the room what the right answer was. The mode rides in the state (`scoring`)
  because the Reveal is handed nothing but the state; a game dealt before speed
  scoring existed carries neither field and is scored flat, which is what it was
  started as.
- **Trivia's settings** — the three the module declares
  (`TRIVIA_SETTINGS_SCHEMA`): the Scoring Mode, a **question count** of 5, 10 or
  20 (default 10), and a **category filter** of `all` or one of the pack's own
  (default `all`). The category options are *derived from the Curated Pack*
  rather than written down beside it — a category is whatever a pack says it is,
  so a pack that gains one gains a filter for it, and every option offered has
  questions behind it. `EVERY_CATEGORY` is the filter set to no filter, and is
  not a category: it *is* the pack format's `RESERVED_CATEGORY`, one constant
  rather than two spellings, so the word the schema refuses and the word the
  filter tests cannot drift apart.
- **Victory Screen** — the last thing the television shows of a game of trivia:
  the Standings with everybody's place on them, and a **Headline** over them
  celebrating whoever won. A place is a `FinalStanding` — a scoreboard row, its
  rank, and whether it won — ranked in competition style, so ties share the top
  rank and spend the ranks they took between them: 1, 1, 3. A **winner** is any
  player on the top rank, so a game has as many winners as tied for it, and the
  headline then says "It's a tie!" rather than naming them: ten seats can tie
  any number of ways, and a party that answered every question wrongly ties all
  ten on nothing. The headline is copy computed in the rules beside the ranks,
  the way the Answer Screen's Eyes up lines are, so that who won and what the
  room is told about it are one answer and not two.
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
- **Code Letter Box** — Boardwalk's rule that a Room Code letter takes its box
  from its tile and never from its own glyph (`codeLetterBox` in `packages/ui`:
  `alignSelf: 'stretch'` with `textAlign: 'center'`). The tiles are fixed cells
  with one centred letter, so measuring the glyph was always the longer route to
  the same pixels — and on tvOS it was a broken one. React Native measures an
  empty `<Text>` by substituting the placeholder string "I", zeroes that width
  because the string was empty, and caches the result under the *placeholder's*
  key — the attributed string, the paragraph attributes and the layout
  constraints — so a real I arriving later under all three was laid out 0pt wide
  and painted nothing. That was the blank Room Code tile.
- **Color tokens** — Boardwalk names its palette by role, and code uses those
  names, never a generic color word: `canvas`, `screen`, `surface`, `ink`,
  `mutedText`, `mutedBorder`, `cobalt`, `tangerine`, `punch`, `green`,
  `yellow`.
- **Tokens only** — Boardwalk's rule that a color, radius, border width, shadow
  depth or font family is *read* from a `packages/ui` token and never written
  where it is used — and the ESLint rule that fails when one is
  (`boardwalk/tokens-only`, in `eslint-rules/`, run by `pnpm lint`). It looks
  inside style contexts alone: a `StyleSheet.create` block, a `style`/`…Style`
  prop, and the Offset Shadow's own two props on `StickerSurface` (`depth`,
  `shadowColor`). That boundary is what keeps it off the domain — `color`
  anywhere else in Huddle is a Player Color or Key Art *name*, which is protocol
  and not a color at all, and `depth` is an ordinary word for a tree node's
  nesting. It keys on the property's name and never on its value,
  because the handoff's measurements are written as plain numbers throughout
  (`width: 148`, `gap: 18`, `fontSize: 88`) and a rule that fired on those is a
  rule somebody switches off; sizes, spacing, sticker tilts, opacity and letter
  spacing are outside it. Two literals are the absence of a design value rather
  than one of Boardwalk's and are admitted as such: `0` for a radius, a border
  width or a depth, and `transparent` for a color. A name is followed to what it
  holds rather than judged by where it was bound — `const ink = colors.ink` is
  as tokenised as `colors.ink`, `const CARD_RADIUS = 24` is not, and `24 + 0` is
  still 24. `fontWeight` is banned rather than tokenised: React
  Native ignores a weight on a custom family, so a family token is the only way
  to ask for bold and a weight at a call site is a face chosen by hand that never
  arrives. Its sibling is the hex scan in `color-literals.test.ts` — that one
  asks what a value *is*, anywhere in the repo; this one asks where it was
  *written*.
- **Body Text Floor** — the smallest body size Boardwalk allows on the surface
  a screen is read from (`minBodyFontSize` in `packages/ui`: 18 on a television
  read across a room, 14 on a phone read from the hand), and the ESLint rule
  that fails when a screen goes under it (`boardwalk/body-text-floor`, in
  `eslint-rules/`, run by `pnpm lint`). Tokens only's opposite half, and a
  separate rule for exactly that reason: that one keys on a property's *name*
  and never looks at a value, which is what lets the handoff's measurements stay
  plain numbers; this one lets `fontSize` be any number and asks only which. The
  two share the walk to a style object (`eslint-rules/style-objects.js`) and
  nothing else.
  Which files stand on which surface is the flat config's question rather than
  the rule's, since that is what ESLint's `files` is for: `apps/tv` and a game
  module's `tv-*` screens are the `tv` surface, `apps/controller` and a module's
  `controller-*` screens the `phone`. Two config blocks and not one repo-wide
  number, because 14 and 18 are two floors and not a lax one and a strict one.
  `packages/ui` is on neither: a shared primitive stands on no one surface, so
  it can be given no floor — none of them sets a `fontSize` today.
  **Body text is everything with a `fontSize` except Boardwalk's display face** —
  a style setting the theme's own `fontFamily.display` is drawing type (a
  wordmark, a Room Code letter, a Countdown) and the handoff floors *body* text.
  Its being the theme's is proved through imports and module aliases rather than
  taken from the name's shape, to the same standard the floor itself is read by. A style naming no
  family is body text, so the floor applies unless a screen says otherwise. A
  size is followed the way Tokens only follows a colour, through a module-level
  constant and through arithmetic, so `minBodyFontSize.tv - 2` is 16 and is
  caught; and the whole `minBodyFontSize` table is handed to the rule rather
  than the one number, so `minBodyFontSize.phone` standing on a television is a
  size it can read rather than a reference it has to wave through. What it
  cannot see is a `<Text>` carrying no size at all, which renders at React
  Native's own 14px — every one on all four surfaces either sets a size or is
  nested in a `<Text>` that does, and that is a fact established by reading
  rather than by the gate. (On the phone that default *is* the floor, so only
  the television is exposed by the gap.)
  The display exemption is where the two surfaces differ in practice: on a
  television nothing sits in it (the smallest display size there is 20), while
  the phone's HOST pill is Bungee at 13, under the phone floor and outside it.
  It is not an exemption anybody can claim on a line — it costs an actual change
  of face, which is a visible one.
  Where the handoff floors body text and also pins a particular element under
  that floor, the floor wins: §2 writes the Controller's field label at 13px and
  the same document's typography section floors phone body at 14, and a floor a
  single spec line can undercut is not a floor. That label reads
  `minBodyFontSize.phone` rather than `14` because 14 is the floor and not this
  element's handoff measurement — a bare number there would read as one. It is
  not the screen's only size the handoff does not give, either: the HOST pill's
  13 was derived from that label's 13, and this is what broke the derivation.
- **Eyes up** — the platform's core UX principle: the TV is the stage; phones
  are minimal controllers; players' eyes belong on the TV and each other. It has
  a gate of its own now, on the half of it that is checkable: see Remote
  Surface.

## Naming Decisions
- We say "Room", never "Lobby" for the entity; "lobby" is only the pre-game
  phase.
- We say "Controller" for the phone app, never "remote".
- We say "Question Pack" (or "pack"), never "quiz" or "question set".
- We say "Host", never "admin", "owner", or "leader".
- We say "away", never "offline" or "AFK".
- We say "Game Module" for the code unit; "game" alone means the thing being
  played.
