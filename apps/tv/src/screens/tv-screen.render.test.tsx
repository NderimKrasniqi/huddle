import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { OpenRoom } from '../platform/room-session';
import { TvScreen, shouldRestoreTvRoom } from './tv-screen';

const MockText = Text;

const restoredRoom: OpenRoom = {
  roomId: 'room-restored' as OpenRoom['roomId'],
  code: 'KWRD',
  restored: true,
  hasRunningGame: false,
};
const freshRoom: OpenRoom = {
  roomId: 'room-fresh' as OpenRoom['roomId'],
  code: 'ABCD',
  restored: false,
  hasRunningGame: false,
};
const restoredGameRoom: OpenRoom = {
  roomId: 'room-running' as OpenRoom['roomId'],
  code: 'GAME',
  restored: true,
  hasRunningGame: true,
};

const mockUseRoomOpening = jest.fn();

jest.mock('../platform/room-session/native', () => ({
  useRoomOpening: () => mockUseRoomOpening(),
}));

jest.mock('./tv-session-controller', () => ({
  TvSessionController: ({ room }: { room: OpenRoom }) => (
    <MockText testID="tv-live-surface">Live room {room.code}</MockText>
  ),
}));

describe('TvScreen restoration handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseRoomOpening.mockReturnValue({
      opening: { kind: 'open', room: freshRoom },
      reopen: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it.each([
    [freshRoom, false],
    [restoredGameRoom, false],
    [restoredRoom, true],
  ])('classifies %s restoration correctly', (room, expected) => {
    expect(shouldRestoreTvRoom(room)).toBe(expected);
  });

  it('keeps a fresh room and a restored game on the existing live surface', async () => {
    for (const room of [freshRoom, restoredGameRoom]) {
      mockUseRoomOpening.mockReturnValue({
        opening: { kind: 'open', room },
        reopen: jest.fn(),
      });
      const rendered = await render(<TvScreen />);
      expect(screen.getByText(`Live room ${room.code}`)).toBeTruthy();
      await rendered.unmount();
    }
  });

  it('shows restore once, then hands the same room to the live surface', async () => {
    mockUseRoomOpening.mockReturnValue({
      opening: { kind: 'open', room: restoredRoom },
      reopen: jest.fn(),
    });
    const rendered = await render(<TvScreen />);

    expect(rendered.getByTestId('tv-restoring-room-screen')).toBeTruthy();
    expect(rendered.getByText('K W R D')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1_300);
    });
    await act(async () => {
      jest.advanceTimersByTime(320);
    });

    expect(rendered.getByText('Live room KWRD')).toBeTruthy();
    expect(rendered.queryByTestId('tv-restoring-room-screen')).toBeNull();
  });
});
