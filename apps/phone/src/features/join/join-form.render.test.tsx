import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { JoinForm } from './join-form';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('JoinForm', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('adapts linked codes and QR navigation without creating a seat', async () => {
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
});
