import { render, screen } from '@testing-library/react-native';

import type { RosterSeat } from '../../models';
import { TvRuntimeStatus } from './game-stage';

function seat(name: string, away: boolean, host = false): RosterSeat {
  return { playerId: name, nickname: name, avatar: 'fox', away, host } as unknown as RosterSeat;
}

describe('TvRuntimeStatus while players reconnect', () => {
  it('lists every missing player and offers the connected Host a way on', async () => {
    const players = [seat('Ada', false, true), ...Array.from({ length: 9 }, (_unused, index) => seat(`Player${index}`, true))];
    await render(<TvRuntimeStatus kind="paused" reason="playerDisconnected" gameId="trivia" roomCode="ABCD" players={players} />);

    expect(screen.getAllByText('Reconnecting', { includeHiddenElements: true })).toHaveLength(9);
    expect(screen.getByText(/9 players lost connection\..*Ada can continue without them\./, { includeHiddenElements: true })).toBeTruthy();
  });

  it('does not say an away Host can continue', async () => {
    const players = [seat('Ada', true, true), seat('Bo', false)];
    await render(<TvRuntimeStatus kind="paused" reason="playerDisconnected" gameId="trivia" roomCode="ABCD" players={players} />);

    expect(screen.getByText('Ada lost connection. The game continues when they’re back.', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText(/can continue without them/, { includeHiddenElements: true })).toBeNull();
  });
});
