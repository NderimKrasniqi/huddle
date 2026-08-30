import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { JoinRoomScreen } from './join-room-screen';

const STANDARD_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

async function renderJoinRoom(
  props: Partial<React.ComponentProps<typeof JoinRoomScreen>> = {},
) {
  const onScanQr = props.onScanQr ?? jest.fn();

  return await render(
    <SafeAreaProvider initialMetrics={STANDARD_METRICS}>
      <JoinRoomScreen {...props} onScanQr={onScanQr} />
    </SafeAreaProvider>,
  );
}

describe('JoinRoomScreen', () => {
  it('renders the supplied artwork, copy, four code cells, and actions without help copy', async () => {
    await renderJoinRoom();

    expect(screen.getByTestId('join-room-background')).toBeTruthy();
    expect(screen.getByTestId('huddle-brand-icon')).toBeTruthy();
    expect(screen.getByTestId('qr-code-icon')).toBeTruthy();
    expect(screen.getByLabelText('Huddle')).toBeTruthy();
    expect(screen.getByText('Join a game!')).toBeTruthy();
    expect(screen.getByText('Enter the 4-letter code\non the TV.')).toBeTruthy();
    expect(screen.getAllByTestId(/room-code-cell-/u)).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Join Room' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Scan QR Code' })).toBeTruthy();
    expect(screen.queryByText(/don.t have a code/iu)).toBeNull();
    expect(screen.queryByText(/how it works/iu)).toBeNull();
  });

  it('normalizes typed content and enables Join only for a complete four-letter code', async () => {
    const onJoinRoom = jest.fn();
    await renderJoinRoom({
      onJoinRoom,
      initialProfile: { version: 1, guestId: '123e4567-e89b-42d3-a456-426614174000', displayName: 'Ada', avatarId: 'fox' },
      availability: null,
    });

    const joinButton = screen.getByRole('button', { name: 'Join Room' });
    expect(joinButton.props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(screen.getByRole('button', { name: 'Enter four-letter room code' })).toBeTruthy();

    await fireEvent.changeText(
      screen.getByTestId('room-code-input', { includeHiddenElements: true }),
      'k 1w-r!d',
    );

    expect(within(screen.getByTestId('room-code-cell-1')).getByText('K')).toBeTruthy();
    expect(within(screen.getByTestId('room-code-cell-2')).getByText('W')).toBeTruthy();
    expect(within(screen.getByTestId('room-code-cell-3')).getByText('R')).toBeTruthy();
    expect(within(screen.getByTestId('room-code-cell-4')).getByText('D')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Room code K W R D' })).toBeTruthy();
    expect(joinButton.props.accessibilityState).toEqual({ disabled: false, busy: false });

    await fireEvent.press(joinButton);
    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith({ code: 'KWRD', nickname: 'Ada', avatarId: 'fox' }));
  });

  it('normalizes a deep-link-prefilled code and makes it immediately joinable', async () => {
    await renderJoinRoom({
      initialCode: ' rjbi ',
      initialProfile: { version: 1, guestId: '123e4567-e89b-42d3-a456-426614174000', displayName: 'Ada', avatarId: 'fox' },
      availability: null,
    });

    expect(within(screen.getByTestId('room-code-cell-1')).getByText('R')).toBeTruthy();
    expect(within(screen.getByTestId('room-code-cell-2')).getByText('J')).toBeTruthy();
    expect(within(screen.getByTestId('room-code-cell-3')).getByText('B')).toBeTruthy();
    expect(within(screen.getByTestId('room-code-cell-4')).getByText('I')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join Room' }).props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });
  });

  it('submits from the display-name keyboard Done action', async () => {
    const onJoinRoom = jest.fn();
    await renderJoinRoom({
      initialCode: 'KWRD',
      initialProfile: {
        version: 1,
        guestId: '123e4567-e89b-42d3-a456-426614174000',
        displayName: 'Ada',
        avatarId: 'fox',
      },
      availability: null,
      onJoinRoom,
    });

    await fireEvent(screen.getByTestId('display-name-input'), 'submitEditing');
    await waitFor(() =>
      expect(onJoinRoom).toHaveBeenCalledWith({
        code: 'KWRD',
        nickname: 'Ada',
        avatarId: 'fox',
      }),
    );
  });

  it('reports its busy state, disables Join, and renders the loading indicator', async () => {
    const onJoinRoom = jest.fn();
    await renderJoinRoom({ initialCode: 'KWRD', isJoining: true, onJoinRoom });

    const joinButton = screen.getByRole('button', { name: 'Join Room' });
    expect(joinButton.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(
      screen.getByTestId('joining-indicator', { includeHiddenElements: true }),
    ).toBeTruthy();

    await fireEvent.press(joinButton);
    expect(onJoinRoom).not.toHaveBeenCalled();
  });

  it('forwards the QR action through its accessible control', async () => {
    const onScanQr = jest.fn();
    await renderJoinRoom({ onScanQr });

    await fireEvent.press(screen.getByRole('button', { name: 'Scan QR Code' }));
    expect(onScanQr).toHaveBeenCalledTimes(1);
  });

  it('opens the ten-avatar picker, marks claimed avatars, and submits the selected identity', async () => {
    const onJoinRoom = jest.fn();
    const avatarSource = jest.fn((avatarId: string) => ({ uri: `avatar://${avatarId}` }));
    await renderJoinRoom({
      initialCode: 'KWRD',
      initialProfile: { version: 1, guestId: '123e4567-e89b-42d3-a456-426614174000', displayName: 'Ada', avatarId: 'fox' },
      availability: { full: false, takenAvatarIds: ['green-alien'] },
      avatarSource,
      onJoinRoom,
    });

    await fireEvent.press(screen.getByTestId('selected-avatar-button'));
    expect(screen.getAllByTestId(/avatar-option-/u)).toHaveLength(10);
    expect(screen.getByTestId('avatar-option-green-alien').props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByTestId('avatar-option-pink-bunny'));
    expect(screen.queryByTestId('avatar-picker')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Join Room' }));
    await waitFor(() => expect(onJoinRoom).toHaveBeenCalledWith({ code: 'KWRD', nickname: 'Ada', avatarId: 'pink-bunny' }));
    expect(avatarSource).toHaveBeenCalledWith('pink-bunny');
  });

  it('surfaces loading and server feedback without losing the identity draft', async () => {
    await renderJoinRoom({
      initialCode: 'KWRD',
      initialProfile: { version: 1, guestId: '123e4567-e89b-42d3-a456-426614174000', displayName: 'Ada', avatarId: 'fox' },
      availability: { full: true, takenAvatarIds: [] },
      error: 'That avatar is unavailable.',
      isJoining: true,
    });

    expect(screen.getByTestId('room-full-feedback')).toBeTruthy();
    expect(screen.getByTestId('join-error')).toBeTruthy();
    expect(screen.getByDisplayValue('Ada')).toBeTruthy();
    expect(screen.getByTestId('joining-indicator')).toBeTruthy();
  });
});
