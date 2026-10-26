import type { RosterSeat } from '../../models';

export type HostControlAction = 'transfer' | 'remove';

export type RosterRowControl = {
  readonly action: HostControlAction;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledBecause: string | undefined;
};

const TRANSFER_AWAY_HINT =
  'They’re away — you can only hand the room to someone who’s still here.';

export function rosterRowControls(seat: RosterSeat): readonly RosterRowControl[] {
  if (seat.host) {
    return [];
  }

  return [
    {
      action: 'transfer',
      label: 'Make host',
      enabled: !seat.away,
      disabledBecause: seat.away ? TRANSFER_AWAY_HINT : undefined,
    },
    {
      action: 'remove',
      label: 'Remove',
      enabled: true,
      disabledBecause: undefined,
    },
  ];
}
