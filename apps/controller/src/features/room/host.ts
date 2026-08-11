import type { RosterSeat } from '../../models';

export type { RosterSeat } from '../../models';

/**
 * The Host, from the phone's side: whether this phone is the one running the
 * room, and what the room's lobby says while it waits.
 *
 * A Controller learns this from the roster rather than from the answer that
 * seated it, because the host moves: a player who joined second becomes the
 * host the moment the room gives up on the first one, and their phone has to
 * say so without being relaunched. The roster is a live subscription, so
 * finding yourself on it is finding out.
 */

/** One seat of the room's roster, as `players.roster` serves it. */
/** Where this phone stands in its room: who is running it, and whether that is them. */
export type LobbyStanding = {
  /** Whether the phone reading this holds room control. */
  readonly youAreHost: boolean;
  /**
   * The Host's name, or `undefined` while the roster has yet to arrive — and in
   * the moment between a room being minted and its first player joining, which
   * no phone is ever on this screen for.
   */
  readonly hostNickname: string | undefined;
  /**
   * The Host's avatar, for the waiting screen's hero — the board draws the
   * player who is choosing, not the player who is waiting. `undefined` for the
   * same two moments `hostNickname` is.
   */
  readonly hostAvatar: RosterSeat['avatar'] | undefined;
};

/** Where `playerId` stands in the room this roster describes. */
export function lobbyStanding(
  roster: readonly RosterSeat[],
  playerId: RosterSeat['playerId'],
): LobbyStanding {
  const host = roster.find((seat) => seat.host);

  return {
    youAreHost: host?.playerId === playerId,
    hostNickname: host?.nickname,
    hostAvatar: host?.avatar,
  };
}

// `lobbyStatusText` was here: one line on a status card telling the Host the
// room was theirs and everybody else whose room it was. The approved boards
// draw neither card. The Host's two screens say whose room it is by being the
// Host's screens, and the player's screen says who they are waiting on in its
// own heading (`hostChoosingLine`) — so the sentence had two better places to
// be said and no place left to be drawn.
