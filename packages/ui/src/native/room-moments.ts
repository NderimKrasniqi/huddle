/** Session-local presentation: never a replacement for room authority. */
type RoomMoments = {
  readonly seenIds?: readonly string[];
  readonly welcomeIds: readonly string[];
  readonly welcomeUntil: number;
  readonly finishedSeen: boolean;
  readonly returned: boolean;
};

export const INITIAL_ROOM_MOMENTS: RoomMoments = {
  welcomeIds: [], welcomeUntil: 0, finishedSeen: false, returned: false,
};

export type RoomMomentSnapshot = {
  /** Undefined until the roster has actually resolved. */
  readonly playerIds?: readonly string[];
  readonly runtime: 'lobby' | 'game' | 'finished' | 'paused' | 'unavailable';
  readonly lobbyResolved: boolean;
  readonly browsing: boolean;
  readonly now: number;
};

export function advanceRoomMoments(previous: RoomMoments, snapshot: RoomMomentSnapshot): RoomMoments {
  const additions = previous.seenIds === undefined ? [] :
    (snapshot.playerIds ?? []).filter((id) => !previous.seenIds?.includes(id));
  const seenIds = snapshot.playerIds === undefined ? previous.seenIds :
    [...new Set([...(previous.seenIds ?? []), ...snapshot.playerIds])];
  const canWelcome = snapshot.lobbyResolved && !snapshot.browsing;
  const welcomed = canWelcome && additions.length > 0;
  const welcomeIds = welcomed ? additions : canWelcome && snapshot.now < previous.welcomeUntil ?
    previous.welcomeIds.filter((id) => snapshot.playerIds?.includes(id)) : [];
  // Pending subscriptions do not consume a finished-to-lobby transition.
  const returned = !snapshot.browsing && snapshot.runtime === 'lobby' &&
    (previous.returned || previous.finishedSeen && snapshot.lobbyResolved);
  return {
    seenIds, welcomeIds, welcomeUntil: welcomed ? snapshot.now + 4600 : previous.welcomeUntil,
    finishedSeen: snapshot.runtime === 'finished' || previous.finishedSeen &&
      snapshot.runtime === 'lobby' && !snapshot.lobbyResolved,
    returned,
  };
}
