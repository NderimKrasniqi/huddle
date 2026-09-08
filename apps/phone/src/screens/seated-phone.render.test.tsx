import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CAROUSEL_REGISTRY } from '@huddle/game-registry';

import { SeatedPhone, PickerSurface, SetupSurface } from './seated-phone';

const mockEndGame = jest.fn();
const mockMutationFunctions = [
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  jest.fn(),
  mockEndGame,
  jest.fn(),
  jest.fn(),
];
let mockMutationHookIndex = 0;
let mockQueryHookIndex = 0;
let mockRunning: unknown = null;
let mockSeat: unknown = null;
let mockBrowsing: number | null | undefined;
let mockSetup: unknown = null;
let mockRoster: unknown[] = [];

jest.mock('convex/react', () => ({
  useMutation: () => {
    const mutation = mockMutationFunctions[mockMutationHookIndex % mockMutationFunctions.length]!;
    mockMutationHookIndex += 1;
    return mutation;
  },
  useQuery: () => {
    const value = [mockRoster, mockRunning, mockSeat, mockBrowsing, mockSetup][mockQueryHookIndex % 5];
    mockQueryHookIndex += 1;
    return value;
  },
}));

jest.mock('../platform/presence/native', () => ({ useHeartbeat: () => undefined }));
jest.mock('../platform/session', () => ({
  usePhoneSession: () => ({
    beginLeave: jest.fn(),
    cancelLeave: jest.fn(),
    sessionToken: 'session-token',
  }),
}));
jest.mock('../ui/reduced-motion', () => ({ usePhoneReducedMotion: () => true }));

const trivia = CAROUSEL_REGISTRY.find((module) => module.metadata.id === 'trivia')!;
const setupRoster = [
  { playerId: 'host', nickname: 'Ada', away: false, host: true, avatar: 'fox' as const },
  { playerId: 'guest', nickname: 'Milo', away: false, host: false, avatar: 'green-alien' as const },
] as unknown as React.ComponentProps<typeof SetupSurface>['roster'];

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

function renderSurface(surface: ReactElement) {
  return render(<SafeAreaProvider initialMetrics={METRICS}>{surface}</SafeAreaProvider>);
}

const hostRoster = [
  { playerId: 'host', nickname: 'Ada', away: false, host: true, avatar: 'fox' as const },
  { playerId: 'guest', nickname: 'Milo', away: false, host: false, avatar: 'green-alien' as const },
];
const guestHostRoster = [
  { playerId: 'host', nickname: 'Ada', away: false, host: false, avatar: 'fox' as const },
  { playerId: 'guest', nickname: 'Milo', away: false, host: true, avatar: 'green-alien' as const },
];
const setupDraft = {
  gameId: 'trivia',
  settings: { questions: '10' },
  mode: 'standard' as const,
  stage: 'ready' as const,
  readyPlayerIds: [],
};

function renderSeated(session: object) {
  mockMutationHookIndex = 0;
  mockQueryHookIndex = 0;
  return renderSurface(
    <SeatedPhone
      session={session as React.ComponentProps<typeof SeatedPhone>['session']}
      onSeatLost={jest.fn()}
      onLeft={jest.fn()}
    />,
  );
}

describe('Heartbeat Phone lifecycle return', () => {
  beforeEach(() => {
    mockEndGame.mockReset().mockResolvedValue(null);
    mockRunning = { kind: 'paused', gameId: 'trivia', reason: 'playerDisconnected' };
    mockSeat = hostRoster[0];
    mockBrowsing = 4;
    mockSetup = setupDraft;
    mockRoster = hostRoster;
  });

  it('returns a Host to the room lobby after ending a game with stale picker state', async () => {
    const result = await renderSeated({
      roomId: 'room-id',
      playerId: 'host',
      code: 'KWRD',
      nickname: 'Ada',
      avatar: 'fox',
    });

    await fireEvent.press(result.getByTestId('runtime-status-back-to-lobby'));
    await fireEvent.press(result.getByTestId('confirmation-confirm'));
    await waitFor(() => expect(mockEndGame).toHaveBeenCalledWith({ sessionToken: 'session-token' }));

    mockRunning = null;
    mockSetup = null;
    mockBrowsing = null;
    await act(async () => {
      result.rerender(
        <SafeAreaProvider initialMetrics={METRICS}>
          <SeatedPhone
            session={{ roomId: 'room-id', playerId: 'host', code: 'KWRD', nickname: 'Ada', avatar: 'fox' } as React.ComponentProps<typeof SeatedPhone>['session']}
            onSeatLost={jest.fn()}
            onLeft={jest.fn()}
          />
        </SafeAreaProvider>,
      );
    });

    await waitFor(() => expect(result.getByTestId('phone-lobby')).toBeTruthy());
    expect(result.queryByTestId('phone-game-picker')).toBeNull();
  });

  it('does not resurrect the picker when a former guest becomes Host after projections clear', async () => {
    mockRunning = null;
    const result = await renderSeated({
      roomId: 'room-id',
      playerId: 'guest',
      code: 'KWRD',
      nickname: 'Milo',
      avatar: 'green-alien',
    });

    // The setup projection is what previously set the guest's local picker
    // flag; the guest itself sees the setup surface while it is still active.
    await waitFor(() => expect(result.getByTestId('phone-game-setup')).toBeTruthy());

    mockRoster = guestHostRoster;
    mockSetup = null;
    mockBrowsing = null;
    await act(async () => {
      result.rerender(
        <SafeAreaProvider initialMetrics={METRICS}>
          <SeatedPhone
            session={{ roomId: 'room-id', playerId: 'guest', code: 'KWRD', nickname: 'Milo', avatar: 'green-alien' } as React.ComponentProps<typeof SeatedPhone>['session']}
            onSeatLost={jest.fn()}
            onLeft={jest.fn()}
          />
        </SafeAreaProvider>,
      );
    });

    await waitFor(() => expect(result.getByTestId('phone-lobby')).toBeTruthy());
    expect(result.queryByTestId('phone-game-picker')).toBeNull();
  });
});

describe('Heartbeat Phone picker', () => {
  it('browses on a card tap and selects only through the separate CTA', async () => {
    const onBrowse = jest.fn();
    const onChoose = jest.fn();
    const onBackToRoom = jest.fn();
    const result = await renderSurface(
      <PickerSurface
        browsingAt={0}
        youAreHost
        hostNickname="Ada"
        busy={null}
        failure="The room could not move the carousel."
        onBrowse={onBrowse}
        onChoose={onChoose}
        onBackToRoom={onBackToRoom}
        onLeave={jest.fn()}
      />,
    );

    await fireEvent.press(result.getByTestId('phone-game-card-trivia'));
    expect(onBrowse).toHaveBeenCalledWith(0);
    expect(onChoose).not.toHaveBeenCalled();
    await fireEvent.press(result.getByTestId('picker-back-top'));
    expect(onBackToRoom).toHaveBeenCalledTimes(1);
    expect(result.queryByTestId('picker-back')).toBeNull();
    expect(result.queryByTestId('picker-leave')).toBeNull();
    expect(result.getByTestId('picker-error')).toHaveTextContent('The room could not move the carousel.');

    await fireEvent.press(result.getByTestId('picker-select'));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('renders guests as passive followers without a Back picker control', async () => {
    const result = await renderSurface(
      <PickerSurface
        browsingAt={0}
        youAreHost={false}
        hostNickname="Ada"
        busy={null}
        onBrowse={jest.fn()}
        onChoose={jest.fn()}
        onBackToRoom={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    expect(result.queryByTestId('picker-back')).toBeNull();
    expect(result.queryByTestId('picker-select')).toBeNull();
    expect(result.getByTestId('phone-game-card-trivia').props.accessibilityRole).toBe('image');
  });

  it('gives the Host the same Ready toggle as every other seat', async () => {
    const onReady = jest.fn();
    const result = await renderSurface(
      <SetupSurface
        module={trivia}
        setup={{ gameId: 'trivia', settings: { questions: '10' }, mode: 'standard', stage: 'ready', readyPlayerIds: ['guest'] }}
        roster={setupRoster}
        playerId="host"
        youAreHost
        busy={null}
        onConfigure={jest.fn()}
        onFinalize={jest.fn()}
        onReopen={jest.fn()}
        onCancel={jest.fn()}
        onReady={onReady}
        onStart={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    const ready = result.getByTestId('toggle-game-ready');
    expect(ready.props.accessibilityState).toMatchObject({ disabled: false });
    expect(result.getByTestId('start-game').props.accessibilityState).toMatchObject({ disabled: true });
    expect(result.getByTestId('setup-nav-back')).toBeTruthy();
    expect(result.queryByTestId('setup-back-to-room')).toBeNull();
    expect(result.getByText('Get everyone ready to play.')).toBeTruthy();
    await fireEvent.press(ready);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('describes an away player as reconnecting when the count is otherwise valid', async () => {
    const awayRoster = [
      { playerId: 'host', nickname: 'Ada', away: false, host: true, avatar: 'fox' as const },
      { playerId: 'guest', nickname: 'Milo', away: true, host: false, avatar: 'green-alien' as const },
    ] as unknown as React.ComponentProps<typeof SetupSurface>['roster'];
    const result = await renderSurface(
      <SetupSurface
        module={trivia}
        setup={{ gameId: 'trivia', settings: { questions: '10' }, mode: 'standard', stage: 'ready', readyPlayerIds: ['host', 'guest'] }}
        roster={awayRoster}
        playerId="host"
        youAreHost
        busy={null}
        onConfigure={jest.fn()}
        onFinalize={jest.fn()}
        onReopen={jest.fn()}
        onCancel={jest.fn()}
        onReady={jest.fn()}
        onStart={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    expect(result.getByText('1 player away. Waiting for them to reconnect.')).toBeTruthy();
    expect(result.getByTestId('start-game').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('keeps player-range guidance when every current seat is ready but too few can start', async () => {
    const onePlayer = [setupRoster[0]!];
    const result = await renderSurface(
      <SetupSurface
        module={trivia}
        setup={{ gameId: 'trivia', settings: { questions: '10' }, mode: 'standard', stage: 'ready', readyPlayerIds: ['host'] }}
        roster={onePlayer}
        playerId="host"
        youAreHost
        busy={null}
        onConfigure={jest.fn()}
        onFinalize={jest.fn()}
        onReopen={jest.fn()}
        onCancel={jest.fn()}
        onReady={jest.fn()}
        onStart={jest.fn()}
        onLeave={jest.fn()}
      />,
    );

    expect(result.getAllByText('Need 2–10 players to start.')).toHaveLength(1);
    expect(result.queryByText('Everyone is ready. The Host can start.')).toBeNull();
    expect(result.getByTestId('start-game').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
