// The Game Module interface (metadata, settings schema, initial-state factory,
// reduce(state, event), TV/Controller screens) lands here in Phase 3. See
// docs/implementation-plan.md. Until then this package holds the room types the
// hub and the game modules share.
export { JOIN_LINK_SCHEME, roomJoinLink } from './join-link';
export type { JoinRejection } from './join-rejection';
export { NICKNAME_MAX_LENGTH } from './nickname';
export { ROOM_PLAYER_CAP } from './room-capacity';
export {
  generateRoomCode,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RandomSource,
} from './room-code';
