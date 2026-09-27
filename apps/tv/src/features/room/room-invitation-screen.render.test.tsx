import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { RoomInvitationScreen } from './room-invitation-screen';

function MockQrCode(props: Record<string, unknown>) {
  return <View {...props} />;
}

jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: MockQrCode,
}));

describe('RoomInvitationScreen', () => {
  it('renders the supplied empty-room invitation with a dynamic QR and ten slots', async () => {
    await render(
      <RoomInvitationScreen roomCode="KWRD" joinUrl="huddle://join/KWRD" reduceMotion />,
    );

    expect(screen.getByText('Grab your phones!')).toBeTruthy();
    expect(screen.getByText('Join at')).toBeTruthy();
    expect(screen.getByText('0 / 10 joined')).toBeTruthy();
    expect(screen.getByText('The first phone to join becomes the host')).toBeTruthy();
    expect(screen.queryByText(/huddle\.game/i)).toBeNull();
    expect(screen.queryByText(/https?:\/\//i)).toBeNull();
    expect(screen.getByText('KWRD', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Room code K W R D').props.focusable).toBe(false);
    expect(screen.getByText('Scan\nto join', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('QR code to join room K W R D').props.focusable).toBe(false);
    expect(screen.getByTestId('room-join-qr').props.value).toBe('huddle://join/KWRD');
    expect(screen.getAllByTestId('empty-player-slot')).toHaveLength(10);
    expect(
      screen.getAllByTestId('empty-player-slot').every((slot) => slot.props.focusable === false),
    ).toBe(true);
    expect(screen.queryAllByTestId('joined-player-slot')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('keeps roster order, names, initials, avatars, and accessible slot labels', async () => {
    await render(
      <RoomInvitationScreen
        roomCode="ABCD"
        joinUrl="huddle://join/ABCD"
        reduceMotion
        players={[
          { id: 'ada', name: 'Ada', host: true },
          { id: 'grace', name: 'Grace', avatarId: 'fox' },
        ]}
      />,
    );

    const joined = screen.getAllByTestId('joined-player-slot');
    expect(joined).toHaveLength(2);
    expect(joined[0]?.props.accessibilityLabel).toBe('Player Ada joined, host');
    expect(joined[1]?.props.accessibilityLabel).toBe('Player Grace joined');
    expect(joined.every((slot) => slot.props.focusable === false)).toBe(true);
    expect(screen.getAllByText('A', { includeHiddenElements: true })).not.toHaveLength(0);
    expect(screen.getByText('Ada', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Grace', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('joined-player-avatar')).toBeTruthy();
    expect(screen.getByText('Come on in!')).toBeTruthy();
    expect(screen.getByText('Ada is choosing what’s next')).toBeTruthy();
    expect(screen.getAllByTestId('empty-player-slot')).toHaveLength(8);
    expect(screen.getByLabelText('Empty player slot 3')).toBeTruthy();
  });

  it('renders at most the ten-player room capacity', async () => {
    const players = Array.from({ length: 11 }, (_unused, position) => ({
      id: `player-${position + 1}`,
      name: `Player ${position + 1}`,
    }));

    await render(
      <RoomInvitationScreen
        roomCode="ROOM"
        joinUrl="huddle://join/ROOM"
        players={players}
      />,
    );

    expect(screen.getAllByTestId('joined-player-slot')).toHaveLength(10);
    expect(screen.getByText('Everyone’s here!')).toBeTruthy();
    expect(screen.getByText('Room full · 10 / 10')).toBeTruthy();
    expect(screen.queryByLabelText('Player Player 11 joined')).toBeNull();
    expect(screen.queryAllByTestId('empty-player-slot')).toHaveLength(0);
  });
});
