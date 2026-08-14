import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import type { RosterSeat } from '../models';
import { TvSessionPresentation } from './tv-session-controller';
import type { TvSurface } from './tv-surface';

function MockQrCode(props: Record<string, unknown>) {
  return <View {...props} />;
}

jest.mock('../platform/room-session/native', () => ({
  keepRoomPresent: jest.fn(),
  useRoomExpiry: jest.fn(),
}));

jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: MockQrCode,
}));

const roster: readonly RosterSeat[] = [
  {
    playerId: 'player-ada' as RosterSeat['playerId'],
    nickname: 'Ada',
    avatar: 'fox',
    away: false,
    host: true,
  },
];

describe('TvSessionPresentation', () => {
  it('selects the illustrated renderer only for the room surface', async () => {
    await render(
      <TvSessionPresentation
        surface="room"
        runtime="lobby"
        roomCode="KWRD"
        roster={roster}
      />,
    );

    expect(screen.getByTestId('room-invitation-background')).toBeTruthy();
    expect(screen.getByLabelText('Player Ada joined')).toBeTruthy();
    expect(screen.queryByText('Room invitation')).toBeNull();
  });

  it.each([
    ['carousel', 'lobby', undefined, 'Choose a game'],
    ['setup', 'lobby', undefined, 'Game setup'],
    ['runtime-status', 'paused', undefined, 'Game paused'],
    ['runtime-status', 'unavailable', undefined, 'Game unavailable'],
    ['game', 'finished', 'trivia', 'Game finished'],
    ['game', 'game', 'trivia', 'Trivia game'],
    ['game', 'game', 'voting', 'Voting game'],
  ] as const)(
    'keeps %s/%s on the purpose renderer',
    async (surface, runtime, gameId, purpose) => {
      await render(
        <TvSessionPresentation
          surface={surface as TvSurface}
          runtime={runtime}
          gameId={gameId}
          roomCode="KWRD"
          roster={roster}
        />,
      );

      expect(screen.getByText(purpose)).toBeTruthy();
      expect(screen.queryByTestId('room-invitation-background')).toBeNull();
    },
  );
});
