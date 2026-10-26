import type { RosterSeat } from '../../models';

export type { RosterSeat } from '../../models';

export type LobbyStanding = {
  readonly youAreHost: boolean;
  readonly hostNickname: string | undefined;
  readonly hostAvatar: RosterSeat['avatar'] | undefined;
};

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
