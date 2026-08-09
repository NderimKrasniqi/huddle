# Project Scope

## Product

A modular huddle platform for people playing together in the same physical room.

The **Android TV** is the shared screen. Each player's **iOS or Android phone** runs the native controller app.

The platform owns shared multiplayer/session infrastructure. Individual games plug into that platform as separate modules.

## MVP Goal

Prove that:

- an Android TV can create and maintain a multiplayer room;
- native phone apps can join and act as individual controllers;
- one player can host and manage the room from their phone while also playing;
- private player state stays private while shared state appears on the TV;
- multiple independent games can run on the same room/session infrastructure;
- players, hosts, and the TV can disconnect and recover without corrupting the room;
- a second game can be added without rebuilding the platform.

The MVP includes:

- the core huddle platform;
- one full multiplayer trivia game;
- one deliberately simple voting/test game that proves game modularity.

## Supported Platforms

### TV

- Android TV only for MVP.
- The TV displays shared state and room/game configuration.
- The TV is not the primary controller.

### Phones

- Native iOS app.
- Native Android app.
- Browser-based controllers are outside MVP.

## Room Lifecycle

Launching the TV app automatically creates a room.

The TV displays:

- a 4-character room code;
- a QR code that opens the phone app's join flow.

The first phone to join becomes host.

The room persists across games. Finishing or deliberately ending a game returns everyone to the existing room instead of creating a new room.

If every player leaves while the TV remains connected, the room stays open as an empty lobby. The next phone to join becomes host.

The room closes when the TV deliberately ends the session or when the TV fails to recover before its recovery window expires.

When the room closes, its server-side session state is discarded.

## Joining

Players join by:

- scanning the TV QR code; or
- entering the 4-character room code in the native phone app.

No account is required.

Before joining, a player chooses:

- a display name;
- an avatar from a built-in avatar collection.

The app may remember the last-used name and avatar locally.

There are no persistent player profiles in the MVP.

A room code identifies a room; it is not an authorization credential.

## Players

The platform supports up to **10 players** in a room.

Each game declares its own:

- minimum player count;
- maximum player count;
- late-join behavior;
- whether it can continue after players leave.

A game can start only when the room player count is within that game's declared range. The MVP does not include benching, participant selection, or pre-game spectator assignment.

## Host

The host is also a normal player.

The host's phone provides both:

- private player/game UI;
- platform-level host controls when needed.

The host can:

- browse games;
- select a game;
- configure supported modes/rules;
- start games;
- pause/resume where supported;
- remove players;
- manually transfer host status;
- end the active game.

The host cannot end the room. That power was removed with `rooms.endRoom`: a
room now ends when its **last player leaves**, and leaving is something every
player can do, not a power one player holds over the rest.

The host cannot inspect information that a game defines as private to another player.

If the host deliberately leaves, host ownership transfers to the longest-connected remaining player before the old host is removed — preferring one the room is still hearing from, but taking a currently-silent one over leaving the room hostless, since a room whose host pointer names nobody is one the remaining players cannot start a game in or repair. If **no** players remain, the room is deleted outright and its Room Code returns to the pool: an empty room has nobody to become its host, and nothing else in the system would ever collect it (see `players.leaveRoom`).

If a host is permanently lost after a disconnect/recovery period, the longest-connected eligible connected player becomes host automatically.

## TV Responsibilities

The TV displays shared state such as:

- room code and QR code;
- joined players and avatars;
- host identity;
- selected/highlighted game;
- game information;
- modes/rules being configured;
- shared gameplay content;
- timers;
- shared results and scores;
- podium/end-game state;
- connection/recovery status.

The TV never receives player-private game information that it does not need.

## Game Selection

Available games appear in a game catalog.

Each game supplies metadata such as:

- name;
- artwork;
- description;
- supported player range;
- estimated duration;
- available modes/rules.

The host browses and selects games from their phone.

The TV mirrors the host's current selection/configuration so the room can see what is being chosen.

Game settings are locked when gameplay starts. To change them, the host ends the game, returns to the room, changes configuration, and starts again unless a future game explicitly supports live setting changes.

## Game Modules

The platform owns:

- room creation;
- joining;
- participant identity and session credentials;
- host ownership;
- connection/reconnection;
- room lifecycle;
- game catalog/selection;
- transition into and out of games.

Individual games own game-specific behavior and state.

Games must not build separate room/join/session infrastructure.

The architecture should allow games to become independently developed modules later.

The MVP does **not** include:

- a public game SDK;
- third-party developer tooling;
- runtime downloading of community games;
- marketplace functionality;
- public game publishing.

The trivia and voting games prove the modular boundary.

## Game Lifecycle

Before starting a game:

1. Host selects a game.
2. TV shows the selection.
3. Host configures supported modes/rules.
4. Platform checks the game's player requirements.
5. Game starts when requirements are satisfied.

Joining the lobby counts as ready by default. A game may introduce additional game-specific readiness rules if necessary.

After a game finishes:

1. Game displays results.
2. Game-specific session state ends.
3. Players return to the existing room.
4. Room membership, names, avatars, and host remain unchanged.
5. Host can replay or choose another game.

If the host deliberately ends an active game, the game ends immediately, unfinished game state/scores are discarded, and everyone returns to the existing room.

## Late Joining

Players may always join the room while it exists.

Each game determines whether a newly joined player can enter active gameplay.

If the current game does not support late joining:

- the player still enters the room;
- they can see appropriate shared room/game status;
- they do not participate in the active game;
- they receive no private information belonging to active players;
- they join gameplay at the next safe point or after the game ends.

## Connectivity

The experience is intended for people physically together in the same room.

Being on the same Wi-Fi network is preferred but **not required**.

Devices may communicate while connected through:

- the same Wi-Fi;
- separate networks;
- mobile data.

Internet access is required for the MVP.

Offline/local-network-only gameplay is outside MVP scope.

## Phone Backgrounding and Disconnection

Brief phone backgrounding, screen locking, or temporary app switching does not immediately count as a disconnect.

The platform uses a short grace period before classifying the player's connection as lost.

If an active player is then considered disconnected:

1. The active game pauses.
2. The host is informed which player disconnected.
3. The player's identity, avatar, session credential, and relevant game state are preserved for a recovery period.
4. The host can:
   - wait for reconnection;
   - continue without the player if the game permits it and minimum player requirements remain satisfied;
   - remove the player.
5. Reconnecting with the valid participant/session credential restores the same participant.

If the host removes a player, the old participant state is invalidated. The removed person may join the room again as a fresh participant. The MVP has no ban/block system.

If a departure leaves the active game below its declared minimum player count, the game cannot continue. The host can wait for recovery or end the game and return to the room.

## Host Disconnection

A temporary host disconnect pauses the active game and allows recovery.

If the host cannot recover before the applicable recovery period, the longest-connected eligible connected player becomes host automatically.

The host may manually transfer host ownership while connected.

## TV Disconnection

The TV represents the shared room session.

If it disconnects:

1. Active gameplay pauses.
2. Room and game state are preserved for a recovery window.
3. Reconnecting the TV restores the existing room and game.
4. If the TV does not recover before the recovery window expires, the room closes and the session ends.

## Scoring

Scoring belongs to each individual game.

The MVP does not include platform-wide cumulative scoring.

Changing games does not carry game scores into the next game.

## MVP Games

### Trivia

The full reference game exercises:

- private phone answers;
- shared TV questions;
- authoritative round timers;
- rounds;
- scoring;
- results;
- game configuration;
- player limits;
- disconnect/reconnect behavior;
- late-join behavior.

A small built-in question set is sufficient for the MVP; no content-management system is required.

### Voting/Test Game

A deliberately simple second game uses the same platform interfaces while implementing different gameplay.

Its purpose is primarily to prove that the platform is genuinely game-independent.

## Persistence

Room and game session data are ephemeral and are deleted when the room closes.

The MVP does not persist:

- room history;
- previous game sessions;
- scores between rooms;
- achievements;
- player statistics;
- profiles;
- coins;
- purchases.

Only convenience preferences such as the last-used display name/avatar may be stored locally on the phone.

Participant/session credentials may be stored securely on-device for reconnection during the active room.

## Explicitly Outside MVP

- Web/browser controllers
- Apple TV or other TV platforms
- Remote/online matchmaking
- Players intentionally participating from different physical locations
- Voice/video chat
- Offline play
- Persistent accounts
- Persistent player profiles
- Achievements/statistics
- Platform-wide scoring
- Coins/currency
- Purchases
- Game marketplace/store
- Public game SDK
- Community-created game distribution
- Runtime downloading/installing of third-Huddles
- Ban/block moderation system
# Feature 6 traceability — Platform Reliability and Maintainability

This section records the reopened reliability work discovered after the
original Phase 1–5 baseline was marked complete. It is intentionally additive:
the product scope and existing room/game behavior remain unchanged.

- **F-006** — Platform Reliability and Maintainability.
- **J-006** — Recover a TV-held session after process termination, network loss,
  and return to service without changing the room identity.
- **C-006.1** — Durable TV identity.
- **C-006.2** — Exact pause/resume.
- **C-006.3** — Validated private game runtime.
- **C-006.4** — Maintainable module boundaries.
- **C-006.5** — Resumable engineering workflow.
- **BR-006** — One live room per TV session token.
- **BR-007** — Invalid game runtimes expose no state.
- **BR-008** — Gameplay cannot advance while the TV is away.
- **BR-009** — Legacy rooms are discarded, not migrated.

# Feature 7 traceability — Full-Codebase Behavior-Preserving Refactor

This refactor changes ownership and engineering safeguards, not product
behavior. It preserves the supported surfaces, room/game contracts, and active
Soft Minimal design while removing the obsolete development room opener.

- **F-007** — Full-Codebase Behavior-Preserving Refactor.
