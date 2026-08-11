/** Durable room-session lifecycle seam for the TV platform. */
export {
  keepOpeningRoom,
  type OpenRoom,
  reopenDelay,
  type RoomOpener,
  type RoomOpening,
  roomOpeningAtLaunch,
  type RoomOpeningCaption,
  roomOpeningCaption,
  roomOpener,
} from './room-opening';
export {
  ensureTvSessionToken,
  isTvIdentityError,
  isTvSessionToken,
  TV_SESSION_TOKEN_KEY,
  TvIdentityError,
  type TvIdentityFailure,
  type TvSessionStore,
} from './tv-session';
