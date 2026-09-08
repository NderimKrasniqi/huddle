import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import JoinIdentityScreen from './join-identity-screen';

const mockReplace = jest.fn();
const mockJoinMutation = jest.fn();
const mockLeaveMutation = jest.fn();
const mockCompleteJoin = jest.fn();
const mockCacheProfile = jest.fn();
const mockBeginLeave = jest.fn();
const mockCancelLeave = jest.fn();
const mockLeaveProvider = jest.fn();
let mockMutationHookIndex = 0;
let mockSession: object | null | undefined = null;
let mockSessionToken: string | undefined;
const mockProfile = {
  version: 1 as const,
  guestId: '123e4567-e89b-42d3-a456-426614174000',
  displayName: 'Ada',
  avatarId: 'fox' as const,
};
let mockAvailability: { readonly full: boolean; readonly takenAvatarIds: readonly string[] } | null | undefined = {
  full: false,
  takenAvatarIds: [],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ code: 'KWRD' }),
}));

jest.mock('convex/react', () => ({
  useMutation: () => (mockMutationHookIndex++ % 2 === 0 ? mockJoinMutation : mockLeaveMutation),
  useQuery: () => mockAvailability,
}));

jest.mock('../platform/session', () => ({
  ...jest.requireActual('../platform/session'),
  usePhoneSession: () => ({
    session: mockSession,
    sessionToken: mockSessionToken,
    completeJoin: mockCompleteJoin,
    rememberProfile: mockCacheProfile,
    beginLeave: mockBeginLeave,
    cancelLeave: mockCancelLeave,
    leave: mockLeaveProvider,
  }),
}));

jest.mock('../features/join/identity', () => ({
  loadGuestProfile: () => Promise.resolve(mockProfile),
  rememberProfile: jest.fn(() => Promise.resolve()),
}));

jest.mock('../ui/reduced-motion', () => ({ usePhoneReducedMotion: () => true }));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

describe('JoinIdentityScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockJoinMutation.mockReset();
    mockLeaveMutation.mockReset();
    mockCompleteJoin.mockClear();
    mockCacheProfile.mockClear();
    mockBeginLeave.mockClear();
    mockCancelLeave.mockClear();
    mockLeaveProvider.mockReset().mockResolvedValue(undefined);
    mockMutationHookIndex = 0;
    mockSession = null;
    mockSessionToken = undefined;
    mockAvailability = { full: false, takenAvatarIds: [] };
    (SecureStore.setItemAsync as jest.Mock).mockClear();
  });

  it('waits for session restoration before exposing identity controls', async () => {
    mockSession = undefined;

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('identity-session-restoring')).toBeTruthy();
    expect(screen.queryByTestId('identity-join')).toBeNull();
  });

  it('suppresses a same-room deep link and returns to the active seat', async () => {
    mockSession = { roomId: 'room-id', playerId: 'player-id', code: 'KWRD', nickname: 'Ada', avatar: 'fox' };
    mockSessionToken = 'old-token';

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(screen.getByTestId('identity-same-room')).toBeTruthy();
    expect(mockJoinMutation).not.toHaveBeenCalled();
  });

  it('requires an authoritative leave before handing a seated phone to another room', async () => {
    mockSession = { roomId: 'old-room', playerId: 'old-player', code: 'OLDX', nickname: 'Ada', avatar: 'fox' };
    mockSessionToken = 'old-token';
    mockLeaveMutation.mockResolvedValue(null);

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('identity-room-handoff')).toBeTruthy();
    expect(screen.queryByTestId('identity-join')).toBeNull();
    await fireEvent.press(screen.getByTestId('identity-confirm-handoff'));

    await waitFor(() => expect(mockLeaveMutation).toHaveBeenCalledWith({ sessionToken: 'old-token' }));
    expect(mockBeginLeave).toHaveBeenCalledTimes(1);
    expect(mockLeaveProvider).toHaveBeenCalledTimes(1);
    expect(mockJoinMutation).not.toHaveBeenCalled();
  });

  it.each([
    ['pending', undefined, 'identity-handoff-availability-pending'],
    ['missing', null, 'identity-handoff-room-missing'],
    ['full', { full: true, takenAvatarIds: [] }, 'identity-handoff-room-full'],
  ] as const)('keeps the current seat while the target room is %s', async (_state, availability, feedbackTestId) => {
    mockSession = { roomId: 'old-room', playerId: 'old-player', code: 'OLDX', nickname: 'Ada', avatar: 'fox' };
    mockSessionToken = 'old-token';
    mockAvailability = availability;

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );

    const confirm = screen.getByTestId('identity-confirm-handoff');
    expect(screen.getByTestId(feedbackTestId)).toBeTruthy();
    expect(confirm.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(confirm);

    expect(mockLeaveMutation).not.toHaveBeenCalled();
    expect(mockLeaveProvider).not.toHaveBeenCalled();
    expect(screen.getByTestId('identity-room-handoff')).toBeTruthy();
  });

  it('keeps the old seat when the authoritative handoff leave is refused', async () => {
    mockSession = { roomId: 'old-room', playerId: 'old-player', code: 'OLDX', nickname: 'Ada', avatar: 'fox' };
    mockSessionToken = 'old-token';
    mockLeaveMutation.mockRejectedValue(new Error('offline'));

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByTestId('identity-confirm-handoff'));

    await waitFor(() => expect(screen.getByTestId('identity-handoff-error')).toBeTruthy());
    expect(mockCancelLeave).toHaveBeenCalledTimes(1);
    expect(mockLeaveProvider).not.toHaveBeenCalled();
  });

  it('keeps identity controls unavailable until provider handoff cleanup finishes', async () => {
    let finishLeave: (() => void) | undefined;
    mockSession = { roomId: 'old-room', playerId: 'old-player', code: 'OLDX', nickname: 'Ada', avatar: 'fox' };
    mockSessionToken = 'old-token';
    mockLeaveMutation.mockResolvedValue(null);
    mockLeaveProvider.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishLeave = resolve;
      }),
    );

    const result = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByTestId('identity-confirm-handoff'));
    await waitFor(() => expect(mockLeaveProvider).toHaveBeenCalledTimes(1));

    // The server subscription can publish the old seat's removal before local
    // credential cleanup settles. That rerender must not expose a join button.
    mockSession = null;
    mockSessionToken = undefined;
    await result.rerender(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByTestId('identity-handoff-pending')).toBeTruthy();
    expect(screen.queryByTestId('identity-join')).toBeNull();

    await act(async () => finishLeave?.());
    await waitFor(() => expect(screen.getByTestId('identity-join')).toBeTruthy());
  });

  it('blocks duplicate authoritative joins during the same event window', async () => {
    let resolveJoin: ((value: object) => void) | undefined;
    mockJoinMutation.mockImplementation(
      () => new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(screen.getByDisplayValue('Ada')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('identity-display-name'), 'Taylor');
    const join = screen.getByTestId('identity-join');

    await fireEvent.press(join);
    await fireEvent.press(join);

    expect(mockJoinMutation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveJoin?.({
        playerId: 'player-id',
        roomId: 'room-id',
        code: 'KWRD',
        nickname: 'Taylor',
        avatar: 'fox',
        sessionToken: 'session-token',
      });
    });
    await waitFor(() => expect(mockCompleteJoin).toHaveBeenCalledTimes(1));
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('huddle.sessionToken', 'session-token');
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('claims the new session before durable credential storage settles', async () => {
    let finishWrite: (() => void) | undefined;
    (SecureStore.setItemAsync as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );
    mockJoinMutation.mockResolvedValue({
      playerId: 'player-id',
      roomId: 'room-id',
      code: 'KWRD',
      nickname: 'Ada',
      avatar: 'fox',
      sessionToken: 'new-session-token',
    });

    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <JoinIdentityScreen />
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(screen.getByDisplayValue('Ada')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('identity-join'));

    // This synchronous claim increments the provider credential revision. A
    // stale-token clear already in flight must therefore repair, rather than
    // delete, the newly minted token when its storage operation finishes.
    await waitFor(() => expect(mockCompleteJoin).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => finishWrite?.());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});
