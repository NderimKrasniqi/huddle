# Huddle Domain Context

- **TV**: the shared Android TV display that owns a room and renders public room/game state.
- **Controller**: the native iOS/Android phone app used by each player.
- **Room**: the persistent multiplayer session identified by a four-character code.
- **Player / seat**: a participant's server-side identity, nickname, avatar, and presence state.
- **Host**: the player who may select, configure, start, pause, resume, end, transfer, or manage the active game.
- **Session Token**: the SecureStore credential that reconnects a phone to its existing seat.
- **Game Module**: the metadata, settings, screens, state, and rules for one installed game.
- **Game Registry**: the ordered client module list and the separate server-only logic list.
- **Room phase**: lobby/configuring/active/paused/finished state derived from the room's game record.
- **Presence**: heartbeat/away state with grace periods for temporary phone backgrounding.
- **Room background**: the static TV artwork behind the title-safe 1280×720 content stage.
- **Boardwalk / Soft Minimal**: Boardwalk is superseded; Soft Minimal is the current visual source of truth.
