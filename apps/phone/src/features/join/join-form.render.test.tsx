import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { ConvexError } from 'convex/values';

import { JoinForm } from './join-form';
import { rememberProfile } from './identity';

const mockPush = jest.fn();
const mockJoinMutation = jest.fn();
let mockAvailability: { full: boolean; takenAvatarIds: string[] } | null = null;
const mockProfile = {
  version: 1 as const,
  guestId: '123e4567-e89b-42d3-a456-426614174000',
  displayName: '',
  avatarId: 'fox' as const,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('convex/react', () => ({
  useMutation: () => mockJoinMutation,
  useQuery: () => mockAvailability,
}));

jest.mock('./identity', () => ({
  loadGuestProfile: () => Promise.resolve(mockProfile),
  rememberProfile: jest.fn(() => Promise.resolve()),
}));

describe('JoinForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockJoinMutation.mockReset();
    mockAvailability = null;
    (rememberProfile as jest.Mock).mockClear();
    (SecureStore.setItemAsync as jest.Mock).mockClear();
  });

  it('adapts linked codes and QR navigation without submitting an incomplete join', async () => {
    const onSeated = jest.fn();

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <JoinForm linkedCode="kwrd" onSeated={onSeated} notice="Deferred seat notice" />
      </SafeAreaProvider>,
    );

    expect(screen.getByRole('button', { name: 'Room code K W R D' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Join Room' }));
    expect(onSeated).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Scan QR Code' }));
    expect(mockPush).toHaveBeenCalledWith('/scan');
  });

  it('submits the profile identity, persists the session, and seats after the mutation succeeds', async () => {
    const onSeated = jest.fn();
    const session = {
      playerId: 'player-id',
      roomId: 'room-id',
      code: 'KWRD',
      nickname: 'Taylor',
      avatar: 'pink-bunny',
      sessionToken: 'session-token',
    };
    mockJoinMutation.mockResolvedValue(session);

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <JoinForm linkedCode="kwrd" onSeated={onSeated} />
      </SafeAreaProvider>,
    );

    // Let the asynchronous GuestProfileV1 load finish before submitting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const name = screen.getByTestId('display-name-input');
    await fireEvent.changeText(name, 'Taylor');
    await fireEvent.press(screen.getByRole('button', { name: 'Join Room' }));

    await waitFor(() => expect(mockJoinMutation).toHaveBeenCalledWith({
      code: 'KWRD',
      nickname: 'Taylor',
      avatar: 'fox',
      guestId: mockProfile.guestId,
    }));
    await waitFor(() => expect(onSeated).toHaveBeenCalledWith(session));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('huddle.sessionToken', 'session-token');
    expect(rememberProfile).toHaveBeenCalledWith(expect.anything(), {
      version: 1,
      guestId: mockProfile.guestId,
      displayName: 'Taylor',
      avatarId: 'fox',
    });
  });

  it('keeps the remembered avatar unavailable instead of silently changing identity', async () => {
    mockAvailability = { full: false, takenAvatarIds: ['fox'] };

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <JoinForm linkedCode="KWRD" onSeated={jest.fn()} />
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('avatar-picker')).toBeTruthy());
    expect(screen.getByTestId('avatar-option-fox').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByTestId('avatar-taken-feedback')).toBeTruthy();
  });

  it('surfaces a server rejection and keeps the draft available for retry', async () => {
    mockJoinMutation.mockRejectedValue(
      new ConvexError({ kind: 'avatarTaken', avatar: 'fox' }),
    );

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <JoinForm linkedCode="KWRD" onSeated={jest.fn()} />
      </SafeAreaProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    await fireEvent.changeText(screen.getByTestId('display-name-input'), 'Taylor');
    await fireEvent.press(screen.getByRole('button', { name: 'Join Room' }));

    await waitFor(() => expect(screen.getByTestId('join-error')).toHaveTextContent(
      'Somebody just took that avatar. Pick another one.',
    ));
    expect(screen.getByDisplayValue('Taylor')).toBeTruthy();
  });

  it('allows only one join mutation while the first submission is pending', async () => {
    let resolveJoin: ((session: object) => void) | undefined;
    mockJoinMutation.mockImplementation(
      () => new Promise((resolve) => { resolveJoin = resolve; }),
    );
    const onSeated = jest.fn();

    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, right: 0, bottom: 34, left: 0 },
        }}
      >
        <JoinForm linkedCode="KWRD" onSeated={onSeated} />
      </SafeAreaProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    await fireEvent.changeText(screen.getByTestId('display-name-input'), 'Taylor');
    const joinButton = screen.getByRole('button', { name: 'Join Room' });
    await fireEvent.press(joinButton);
    await fireEvent.press(joinButton);

    expect(mockJoinMutation).toHaveBeenCalledTimes(1);
    resolveJoin?.({
      playerId: 'player-id',
      roomId: 'room-id',
      code: 'KWRD',
      nickname: 'Taylor',
      avatar: 'fox',
      sessionToken: 'session-token',
    });
    await waitFor(() => expect(onSeated).toHaveBeenCalledTimes(1));
  });
});
