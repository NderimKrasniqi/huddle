export type { ColorRejection } from './color-rejection';
// The Game Module interface: the whole of what the hub knows about a game, and
// the reason a second game is an entry in the Registry rather than a change to
// the hub.
export type {
  ControllerGameScreenProps,
  GameEvent,
  GameKeyArt,
  GameLogic,
  GameLogicRegistry,
  GameMetadata,
  GameModule,
  GamePlayer,
  GamePlayerId,
  GameRegistry,
  GameSetting,
  GameSettingOption,
  GameSettingsSchema,
  GameSetup,
  PlayerRange,
  TvGameScreenProps,
} from './game-module';
export { JOIN_LINK_SCHEME, roomJoinLink } from './join-link';
export type { JoinRejection } from './join-rejection';
// The names only, as with the player colors below: a module declares the color
// its Key Art wears, and `packages/ui` says what that color is.
export { KEY_ART_COLOR_NAMES, type KeyArtColorName } from './key-art';
export { NICKNAME_MAX_LENGTH } from './nickname';
// The names only: what a swatch looks like is Boardwalk's business, and lives
// in `packages/ui`, which keys its palette off this list.
export {
  isPlayerColorName,
  PLAYER_COLOR_NAMES,
  type PlayerColorName,
} from './player-color';
// Presence is a two-sided rule: the Controller keeps the beat, the room keeps
// the deadline, and neither number means anything alone.
export { AWAY_AFTER_MS, HEARTBEAT_INTERVAL_MS } from './presence';
export { ROOM_PLAYER_CAP } from './room-capacity';
// The room's two phases and the rules for moving between them. The phase is
// read off the running game rather than stored beside it — see `room-phase`.
export {
  defaultSettings,
  type GameLifecycleIntent,
  type GameLifecycleRejection,
  phaseAfter,
  roomPhase,
  ROOM_PHASES,
  type RoomPhase,
  type RunningGame,
} from './room-phase';
// The third presence number, and the room's own: how long it outlives the last
// phone it heard from.
export { ROOM_EXPIRY_MS } from './room-expiry';
export {
  generateRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RandomSource,
} from './room-code';
// Only the minting is shared: no client ever validates a Session Token's
// shape, so the alphabet and length stay inside the module that draws them.
export { generateSessionToken } from './session-token';
