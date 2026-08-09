export type { HostControlRejection } from './host-control-rejection';
// The Game Module interface: the whole of what the hub knows about a game, and
// the reason a second game is an entry in the Registry rather than a change to
// the hub.
export { gamePlayersFrom } from './game-module';
export type {
  ControllerGameScreenProps,
  GameDeadline,
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
  RosterSeatForGame,
  TvGameScreenProps,
} from './game-module';
// The Host's settings as everything outside a game module holds them, settled
// and refused generically against whatever schema the game declares.
export { type GameSettings, settingsFrom, settingsRefusal } from './game-settings';
export { JOIN_LINK_SCHEME, roomJoinLink } from './join-link';
// Which seats a screen watched arrive, so both clients can greet an arrival the
// same way. Here rather than in an app because both draw a roster now.
// `isArrival` is deliberately not among them: it answers "did this screen ever
// watch them arrive", which is permanent, and a client that asked it instead of
// `isGreeting` would draw the chip for the life of the room.
export { type Arrivals, isGreeting, JUST_JOINED_MS, noteArrivals } from './just-joined';
export type { JoinRejection } from './join-rejection';
// The names only: a module declares the colour its Key Art wears, and
// `packages/ui` says what that colour is.
export { AVATAR_IDS, type AvatarId, isAvatarId } from './avatar';
export { KEY_ART_COLOR_NAMES, type KeyArtColorName } from './key-art';
export { NICKNAME_MAX_LENGTH } from './nickname';
// The names only: what a swatch looks like is Soft Minimal's business, and lives
// in `packages/ui`, which keys its palette off this list.
// Presence is a two-sided rule: the Controller keeps the beat, the room keeps
// the deadline, and neither number means anything alone.
export { AWAY_AFTER_MS, HEARTBEAT_INTERVAL_MS } from './presence';
export { ROOM_PLAYER_CAP } from './room-capacity';
// The room's two phases and the rules for moving between them. The phase is
// read off the running game rather than stored beside it — see `room-phase`.
export {
  type GameLifecycleIntent,
  type GameLifecycleRejection,
  phaseAfter,
  refusalToStart,
  roomPhase,
  ROOM_PHASES,
  type RoomPhase,
  type RunningGame,
  type RunningGameResponse,
} from './room-phase';
// The room's own two: how long it outlives the last phone it heard from, and
// how long it is held for a television whose party never arrived at all.
export { ROOM_EXPIRY_MS, UNJOINED_ROOM_EXPIRY_MS } from './room-expiry';
export {
  generateRoomCode,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_MINT_ALPHABET,
  ROOM_CODE_LENGTH,
  type RandomSource,
} from './room-code';
// Only the minting is shared: no client ever validates a Session Token's
// shape, so the alphabet and length stay inside the module that draws them.
export { generateSessionToken } from './session-token';
