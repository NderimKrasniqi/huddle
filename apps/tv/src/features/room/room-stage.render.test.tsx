import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { AVATAR_SOURCES } from '@huddle/ui/native';

import type { RosterSeat } from '../../models';
import { RoomStage } from './room-stage';

function MockQrCode(props: Record<string, unknown>) {
  return <View {...props} />;
}

jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: MockQrCode,
}));

function seat(nickname: string): RosterSeat {
  return {
    playerId: `player-${nickname}` as RosterSeat['playerId'],
    nickname,
    avatar: 'fox',
    away: false,
    host: false,
  };
}

describe('RoomStage', () => {
  it('maps the authoritative roster and canonical join link into the renderer', async () => {
    await render(<RoomStage roomCode="KWRD" roster={[seat('Ada'), seat('Grace')]} />);

    expect(screen.getByTestId('room-join-qr').props.value).toBe('huddle://join/KWRD');
    expect(screen.getAllByTestId('joined-player-avatar')[0]?.props.source).toBe(AVATAR_SOURCES.fox);
    expect(
      screen.getAllByTestId('joined-player-slot').map((slot) => slot.props.accessibilityLabel),
    ).toEqual(['Player Ada joined', 'Player Grace joined']);
    expect(screen.getAllByTestId('empty-player-slot')).toHaveLength(8);
  });

  it('resolves every stable avatar id to bundled artwork for TV roster seats', () => {
    expect(Object.keys(AVATAR_SOURCES)).toEqual([
      'fox',
      'green-alien',
      'pink-bunny',
      'blue-robot',
      'purple-owl',
      'yellow-robot',
      'red-robot',
      'teal-bear',
      'mint-cat',
      'puppy',
    ]);
    expect(Object.values(AVATAR_SOURCES).every((source) => source !== undefined)).toBe(true);
  });
});
