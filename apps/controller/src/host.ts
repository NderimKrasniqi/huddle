import type { api } from '@huddle/convex';
import type { FunctionReturnType } from 'convex/server';

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
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];

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
  };
}

/**
 * The line on the lobby's status card (docs/design/design-handoff.md §4).
 *
 * The host's own phone is told it is the host, and everybody else is told who
 * they are waiting on — which is the handoff's copy, and the reason the host is
 * on the roster at all. Until the roster lands there is no name to name, so the
 * card falls back to the one thing that is true on every phone in the room: the
 * player's name is up on the television.
 *
 * There is nothing here for the host to *do* yet. Picking a game, settings and
 * start are Phase 3 (docs/implementation-plan.md), so this screen states the
 * role and the controls arrive on it later.
 */
export function lobbyStatusText({ youAreHost, hostNickname }: LobbyStanding): string {
  if (youAreHost) {
    return 'You’re running this room — you’ll pick the game when everyone’s in.';
  }

  return hostNickname === undefined
    ? 'Eyes on the TV — your name is up there now.'
    : `Eyes on the TV — ${hostNickname} is about to pick a game.`;
}
