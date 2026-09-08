import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import {
  TV_RESTORE_READY_DELAY_MS,
  TvRestoringRoomScreen,
} from './tv-restoring-room-screen';
import { TV_RESTORE_CHECK_DURATION_MS } from './tv-restore-indicator';

describe('TvRestoringRoomScreen', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the restoring stage without exposing the room before handoff', async () => {
    await render(
      <TvRestoringRoomScreen roomCode="kwrd" stage="restoring" />,
    );

    expect(screen.getByText('Restoring your room…')).toBeTruthy();
    expect(screen.getByLabelText(/Room code K W R D/).props.focusable).toBe(false);
    expect(screen.getByTestId('tv-restoring-room-background')).toBeTruthy();
    expect(screen.getByTestId('tv-restore-indicator')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('renders the ready stage and exact ready copy when controlled', async () => {
    await render(<TvRestoringRoomScreen roomCode="ABCD" stage="ready" />);

    expect(screen.getByText('Your room is ready')).toBeTruthy();
    expect(screen.getByLabelText(/Room code A B C D/).props.focusable).toBe(false);
    expect(screen.getByTestId('tv-restore-indicator')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('honors the system reduced-motion preference without a decorative wait or animation', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const spring = jest.spyOn(Animated, 'spring');
    const onReady = jest.fn();

    await render(<TvRestoringRoomScreen roomCode="ROOM" onReady={onReady} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Your room is ready')).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(timing).not.toHaveBeenCalled();
    expect(spring).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(TV_RESTORE_READY_DELAY_MS);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('falls back to static reduced motion when the system query rejects', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockRejectedValue(
      new Error('native motion preference unavailable'),
    );
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const timing = jest.spyOn(Animated, 'timing');
    const spring = jest.spyOn(Animated, 'spring');
    const onReady = jest.fn();

    await render(<TvRestoringRoomScreen roomCode="ROOM" onReady={onReady} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Your room is ready')).toBeTruthy();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(
      setTimeoutSpy.mock.calls.some(([, delay]) => delay === TV_RESTORE_READY_DELAY_MS),
    ).toBe(false);
    expect(timing).not.toHaveBeenCalled();
    expect(spring).not.toHaveBeenCalled();
  });

  it('flips to ready around 1.3s and hands off once after the check spring', async () => {
    jest.useFakeTimers();
    const onReady = jest.fn();
    await render(<TvRestoringRoomScreen roomCode="ROOM" onReady={onReady} reduceMotion={false} />);

    expect(screen.getByText('Restoring your room…')).toBeTruthy();
    expect(onReady).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(TV_RESTORE_READY_DELAY_MS);
    });

    expect(screen.getByText('Your room is ready')).toBeTruthy();
    expect(screen.getByTestId('tv-restore-indicator')).toBeTruthy();
    expect(onReady).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(TV_RESTORE_CHECK_DURATION_MS);
    });

    expect(onReady).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(TV_RESTORE_CHECK_DURATION_MS * 2);
    });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('cleans the pending restore handoff when unmounted', async () => {
    jest.useFakeTimers();
    const onReady = jest.fn();
    const rendered = await render(
      <TvRestoringRoomScreen roomCode="ROOM" onReady={onReady} reduceMotion={false} />,
    );

    await rendered.unmount();
    await act(async () => {
      jest.advanceTimersByTime(
        TV_RESTORE_READY_DELAY_MS + TV_RESTORE_CHECK_DURATION_MS * 2,
      );
    });

    expect(onReady).not.toHaveBeenCalled();
  });
});
