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

  it('selects the illustrated carousel renderer for a browsed room', async () => {
    await render(
      <TvSessionPresentation
        surface="carousel"
        runtime="lobby"
        roomCode="KWRD"
        roster={roster}
        browsingAt={1}
        setup={null}
        reduceMotion
      />,
    );

    expect(screen.getByTestId('tv-game-carousel')).toBeTruthy();
    expect(screen.getByLabelText('Voting, selected')).toBeTruthy();
    expect(screen.queryByTestId('room-invitation-background')).toBeNull();
  });

  it('selects the illustrated setup renderer from the authoritative draft', async () => {
    await render(
      <TvSessionPresentation
        surface="setup"
        runtime="lobby"
        roomCode="KWRD"
        roster={[
          ...roster,
          {
            playerId: 'player-bo' as RosterSeat['playerId'],
            nickname: 'Bo',
            avatar: 'fox',
            away: false,
            host: false,
          },
        ]}
        browsingAt={0}
        setup={{
          gameId: 'trivia',
          settings: { questions: '10' },
          mode: 'standard',
          stage: 'configuring',
          readyPlayerIds: [],
        }}
        reduceMotion
      />,
    );

    expect(screen.getByTestId('tv-game-setup')).toBeTruthy();
    expect(screen.getByTestId('tv-game-setting-questions')).toBeTruthy();
    expect(screen.queryByText('Game setup')).toBeNull();
  });

  it.each([
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
      expect(screen.queryByTestId('tv-game-carousel')).toBeNull();
    },
  );
});
