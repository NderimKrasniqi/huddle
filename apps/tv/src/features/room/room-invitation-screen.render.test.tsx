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
      <RoomInvitationScreen roomCode="KWRD" joinUrl="huddle://join/KWRD" />,
    );

    expect(screen.getByTestId('room-invitation-background')).toBeTruthy();
    expect(screen.getByTestId('room-invitation-phone-icon')).toBeTruthy();
    expect(screen.getByText('Room Code')).toBeTruthy();
    expect(screen.getByText('K W R D', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Room code K W R D').props.focusable).toBe(false);
    expect(screen.getByText('Waiting for players to join...')).toBeTruthy();
    expect(screen.getByText('Scan to join on\nyour phone')).toBeTruthy();
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
        players={[
          { id: 'ada', name: 'Ada' },
          { id: 'grace', name: 'Grace', avatar: { uri: 'avatar://grace' } },
        ]}
      />,
    );

    const joined = screen.getAllByTestId('joined-player-slot');
    expect(joined).toHaveLength(2);
    expect(joined[0]?.props.accessibilityLabel).toBe('Player Ada joined');
    expect(joined[1]?.props.accessibilityLabel).toBe('Player Grace joined');
    expect(joined.every((slot) => slot.props.focusable === false)).toBe(true);
    expect(screen.getByText('A', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Ada', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Grace', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('joined-player-avatar').props.source).toEqual({
      uri: 'avatar://grace',
    });
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
    expect(screen.queryByLabelText('Player Player 11 joined')).toBeNull();
    expect(screen.queryAllByTestId('empty-player-slot')).toHaveLength(0);
  });
});
