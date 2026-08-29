import { act, render, screen } from '@testing-library/react-native';

import {
  TV_RESTORE_READY_DELAY_MS,
  TvRestoringRoomScreen,
} from './tv-restoring-room-screen';
import { TV_RESTORE_CHECK_DURATION_MS } from './tv-restore-indicator';

describe('TvRestoringRoomScreen', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the restoring stage with the authoritative four-letter code', async () => {
    await render(
      <TvRestoringRoomScreen roomCode="kwrd" stage="restoring" />,
    );

    expect(screen.getByText('Welcome back!')).toBeTruthy();
    expect(screen.getByText('Restoring your room…')).toBeTruthy();
    expect(screen.getByText('K W R D')).toBeTruthy();
    expect(screen.getByLabelText('Room code K W R D').props.focusable).toBe(false);
    expect(screen.getByTestId('tv-restoring-room-background')).toBeTruthy();
    expect(screen.getByTestId('tv-restore-indicator')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('renders the ready stage and exact ready copy when controlled', async () => {
    await render(<TvRestoringRoomScreen roomCode="ABCD" stage="ready" />);

    expect(screen.getByText('Welcome back!')).toBeTruthy();
    expect(screen.getByText('Your room is ready')).toBeTruthy();
    expect(screen.getByText('A B C D')).toBeTruthy();
    expect(screen.getByTestId('tv-restore-indicator')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it('flips to ready around 1.3s and hands off once after the check spring', async () => {
    jest.useFakeTimers();
    const onReady = jest.fn();
    await render(<TvRestoringRoomScreen roomCode="ROOM" onReady={onReady} />);

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
      <TvRestoringRoomScreen roomCode="ROOM" onReady={onReady} />,
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
