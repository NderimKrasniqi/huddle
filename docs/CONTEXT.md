# Huddle Domain Context

- **TV**: the shared Android TV display that owns a room and renders public room/game state.
- **Controller**: the native iOS/Android phone app used by each player.
- **Room**: the persistent multiplayer session identified by a four-character code.
- **Player / seat**: a participant's server-side identity, nickname, avatar, and presence state.
- **Host**: the player who may select, configure, start, pause, resume, end, transfer, or manage the active game.
- **Session Token**: the SecureStore credential that reconnects a phone to its existing seat.
- **TV Session Token**: the durable SecureStore credential that restores one TV-owned room and authorizes TV heartbeats.
- **Game Module**: the client-safe metadata, settings, screens, and shared state types for one installed game.
- **Game Logic**: one game's server-only validation, initial state, reducer, and privacy projection.
- **Game Registry**: the ordered client module list and its separate server-only logic list.
- **Room phase**: `lobby` or `in-game`, derived from whether the room holds a game record.
- **Running-game status**: the client projection of that in-game record — `running`, `paused`, or `unavailable`; the platform owns the pre-game Game Setup surface, while individual modules own their internal gameplay beats such as answering, reveal, or finished.
- **Presence**: heartbeat/away state with grace periods for temporary phone backgrounding.
- **Room background**: the static TV artwork behind the title-safe 1280×720 content stage.
- **Boardwalk / Soft Minimal**: Boardwalk is superseded; Soft Minimal is the current visual source of truth.
