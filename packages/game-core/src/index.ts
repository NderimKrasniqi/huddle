// The Game Module interface (metadata, settings schema, initial-state factory,
// reduce(state, event), TV/Controller screens) lands here in Phase 3. See
// docs/implementation-plan.md. Until then this package holds the room types the
// hub and the game modules share.
export type { ColorRejection } from './color-rejection';
export { JOIN_LINK_SCHEME, roomJoinLink } from './join-link';
export type { JoinRejection } from './join-rejection';
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
export {
  generateRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RandomSource,
} from './room-code';
// Only the minting is shared: no client ever validates a Session Token's
// shape, so the alphabet and length stay inside the module that draws them.
export { generateSessionToken } from './session-token';
