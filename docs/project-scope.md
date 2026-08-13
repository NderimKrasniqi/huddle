# Huddle product scope

## Problem

Local multiplayer party games often create unnecessary friction between the
shared screen and the people playing. Console-style games require dedicated
controllers, while browser-based party games can feel disconnected from a
native living-room product.

The platform work is also repeatedly rebuilt by individual games: creating and
joining rooms, identifying players, assigning a Host, tracking presence and
readiness, selecting games, recovering from disconnects, and returning everyone
to a shared lobby. Huddle must own that game-night lifecycle once so independent
games can concentrate on gameplay.

## Product solution

Huddle is a native local multiplayer party-game platform. One TV is the shared
social display and each player uses the Huddle Phone app as their personal
companion surface. The TV creates a room with a four-character code and QR code;
iOS and Android phones join it without requiring an account.

The first Phone to join becomes Host. The Host browses games, selects and
configures one, manages the room, finalizes setup, participates in readiness,
and explicitly starts or ends the game. Convex keeps the authoritative room,
membership, presence, setup, and game state so no individual device is trusted
as the source of truth.

Huddle owns behavior before, between, and around games. A game module owns its
metadata, settings, rules, state, and Phone/TV presentation. Adding another
installed game must not require game-specific branches in the Huddle platform.

## Current milestone

The current release proves the reusable platform loop with two installed
launch-proof modules, Trivia and Voting. It does not yet ship full rounds,
answers, votes, scoring, winners, or results. Each module proves that its own
settings resolve into module-owned Phone and TV screens and that the Host can
return every client to the same lobby.

The implementation should remain no larger than this milestone requires while
keeping the platform/game boundary durable enough for later complete games.

## Supported and roadmap platforms

- Supported: iOS Phone, Android Phone, and Android TV.
- The TV application uses one shared React Native TV codebase.
- Experimental evidence only: Apple TV/tvOS compile and simulator run.
- Out of scope for this milestone: web clients, store submission, production
  release tooling, and Apple TV release support.

## Rooms and joining

- The TV creates and owns one durable room and restores it with a private TV
  credential.
- A room is located by a four-character code. The code is not authentication.
- The TV also presents a QR code for the canonical `huddle://join/{CODE}` deep
  link.
- The Phone supports both manual code entry and QR scanning.
- The scanner handles camera permission, denial/settings, unavailable camera,
  malformed payloads, duplicate scans, and replacement navigation into the join
  route.
- Joining requires a display name and one of the ten built-in avatars.
- A room holds at most 10 seats; both installed games currently require 2–10
  players.
- The room and its code survive temporary client disconnects. A room is removed
  after the current ten-minute inactivity policy when neither its TV nor its
  seated party remains active.

## Player identity and membership

- No account is required to join and play.
- Each Phone stores `GuestProfileV1`: a UUID `guestId`, display name, and avatar.
- The profile persists locally, migrates earlier saved name/avatar data, and can
  prefill a future join.
- `guestId` is non-secret metadata used for identity continuity and limits. It
  never authenticates, authorizes, or recovers a seat.
- A private SecureStore session credential is the only Phone authority for a
  current seat.
- Editing local profile data affects future joins, not the identity or authority
  of an existing seat.
- Leaving gives up the current seat. Removal by the Host invalidates that seat;
  the player may join again as a new seat while the room remains available.

## Host system

- The first seated player is Host. The TV is never Host.
- Host-only actions are browsing/selecting games, editing/finalizing setup,
  starting/ending, managing players, and transferring Host authority.
- A deliberate transfer can target only another player whose Phone is present.
- If the Host leaves, Huddle transfers authority to the longest-connected
  remaining seat, preferring a present player.
- If the Host is confirmed away, Huddle transfers authority to the
  longest-connected present player when one exists.
- If everybody is away, the room retains its Host rather than manufacturing an
  absent successor. The first returning present player repairs Host ownership
  when necessary.
- Host transfer preserves every other player’s readiness.

## Presence, reconnection, and recovery

- A foregrounded Phone sends a heartbeat every three seconds and becomes away
  after approximately 13 seconds without one.
- Away state is visible to the room and does not itself delete a seat.
- An away player retains Ready state but blocks a new game from starting.
- A running game pauses when a player or the TV disconnects. The Host can wait
  for players to return, continue without disconnected players, or return the
  room to the lobby.
- A returning Phone resumes through its current seat credential while that seat
  and room still exist.
- A restarting TV restores its room through its durable TV credential.
- Room expiry clears the room, seats, setup, game state, credentials, and any
  pending game deadline without relying on a connected client.

## Game browsing and selection

- The Host browses the installed catalog from the Phone.
- The TV mirrors the Host’s current carousel position in real time.
- The Host selects an installed game from the Phone; placeholder catalog cards
  may be browsed but cannot be selected or started.
- Selected-game and browsing state are authoritative room state shared by every
  connected client.
- The platform shows each module’s title, artwork, category, estimated duration,
  and declared player range without knowing its rules.

## Game configuration and readiness

- A game declares the settings and presets the common setup surface renders.
- Trivia exposes **Questions: 5 or 10**.
- Voting exposes **Rounds: 3 or 5**.
- Setup is either `configuring` or `ready`. Only the Host changes settings,
  finalizes them, or reopens a locked setup.
- Finalizing validates and locks the resolved settings. Settings cannot change
  while locked.
- Each player controls only their own Ready flag; the Host must also Ready.
- Start is never automatic. It requires locked settings, every seated player
  Ready, every seated player present, and the selected game’s player range.
- New arrivals are unready. Leaving or removal drops that seat’s Ready flag.
- Reopening setup, switching games, ending a game, or room expiry clears
  readiness.

## Game ownership and lifecycle

Huddle owns:

- rooms, room codes, TV ownership, seats, Host, and presence;
- catalog browsing, selection, shared configuration, and readiness;
- launch authorization, reconnect/pause framing, ending, and lobby return;
- common loading, failure, recovery, and platform navigation surfaces.

Each game module owns:

- a stable game ID and metadata;
- minimum and maximum players;
- settings definitions and presentation hints;
- server-safe state decoding, rules, events, deadlines, and viewer projection;
- module-specific Phone and TV screens;
- future game content, private information, rounds, scoring, and results.

The current journey is:

`TV creates room → Phone scans or enters code → player joins → Host selects and
configures a game → Host locks setup → every seated player Readies → Host
explicitly starts → module-owned entered screen → Host ends → every client
returns to the same lobby`

The proof modules have one `entered` phase, accept no player events, schedule no
deadlines, and expose only the selected setting plus started confirmation.
Trivia’s earlier playable engine and question pack remain reference-only under
`games/trivia/future/`; Voting’s earlier gameplay is not part of the current
product.

## TV experience

The current TV app provides:

- room opening/restoration, room code, QR code, and a 2×5 seat grid;
- Host, present, away, and just-joined roster treatments;
- the game carousel driven by the Host Phone;
- selected-game setup, locked settings, and readiness progress;
- module-owned entered-game presentation;
- player/TV disconnect and recovery presentation;
- return to the shared lobby after the Host ends a game.

Android TV is display-only for this milestone: it must expose no accidental
focusable controls. Physical remote-focus verification remains a release gate.

## Phone experience

The current Phone app provides:

- manual-code and QR joining;
- persistent guest name/avatar setup;
- room status, roster, presence, readiness, and Leave confirmation;
- Host player management and deliberate Host transfer;
- Host catalog browsing, selection, settings, finalize/edit, Start, and End;
- module-owned entered-game presentation;
- session loss, player disconnect, TV disconnect, and recovery framing.

The module screen is the extension point for future private answers, votes,
secret information, cards, drawing, and other game-specific input. Those
gameplay controls are not shipped by the current proof modules.

## Security and abuse protection

- Convex validates membership, Host privileges, setup changes, Ready changes,
  starts/ends, transfers, removals, reconnects, and game events.
- Public actions derive player identity from private credentials; callers do not
  supply an authoritative player ID.
- Client-safe module exports exclude server rules and future Trivia content;
  Convex imports game logic without React Native screens.
- Structured `rateLimited` rejections identify the operation and include
  `retryAfterMs`.
- Token buckets are: rooms 10/minute (20 capacity); joins global 600/minute
  (1,200), per room 120/minute (240), per guest 60/minute (120); member commands
  180/minute (360); Host and TV credentials 120/minute (240); game events
  30/second (60).
- Heartbeats, scheduled callbacks, and maintenance are exempt from command rate
  buckets so rate limiting cannot manufacture disconnects.

## Release acceptance

The milestone must prove room creation/restoration, manual and QR joining,
persistent guest identity, first-player Host assignment, automatic succession,
presence/reconnect behavior, game browsing and configuration, the full Ready
gate, launch and End for both proof modules, structured rate limits, bundle
isolation, and supported-platform builds.

Physical evidence must cover a real Phone camera reading the TV QR code, mixed
iOS/Android phones, and Android TV remote focus. The current evidence mapping is
[`acceptance-matrix.md`](./acceptance-matrix.md).

## Known future capabilities — not current scope

- Complete Trivia, Voting, and additional game loops with rounds, private input,
  timers, scoring, winners, results, replay, and richer shared animation.
- Downloadable or paid games, a store/catalog service, ownership, and
  entitlements.
- Optional Huddle accounts, cloud profiles, statistics, achievements, and a
  platform economy.
- Third-party games, a public Huddle game SDK, developer tooling, documentation,
  and submissions.
- Web clients, analytics, Sentry, and production store/release operations.

## Scope principle

Build only what the current milestone needs. Preserve boundaries where they
protect foreseeable product evolution, but do not implement infrastructure
whose only purpose is a hypothetical future.
