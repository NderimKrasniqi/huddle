import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RoomCodeScreen } from './room-code-screen';

const STANDARD_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

async function renderRoomCode(
  availability: React.ComponentProps<typeof RoomCodeScreen>['availability'],
  onContinue = jest.fn(),
) {
  const result = await render(
    <SafeAreaProvider initialMetrics={STANDARD_METRICS}>
      <RoomCodeScreen
        code="KWRD"
        availability={availability}
        onContinue={onContinue}
        onScanQr={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  return { result, onContinue };
}

describe('RoomCodeScreen', () => {
  it.each([
    ['pending', undefined],
    ['missing', null],
    ['full', { full: true, takenAvatarIds: [] }],
  ] as const)('does not advance while the room is %s', async (_state, availability) => {
    const { result, onContinue } = await renderRoomCode(availability);

    const continueButton = result.getByRole('button', { name: 'Continue to pick your vibe' });
    expect(continueButton.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(continueButton);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('advances only when the server says the room has capacity', async () => {
    const onContinue = jest.fn();
    const result = await render(
      <SafeAreaProvider initialMetrics={STANDARD_METRICS}>
        <RoomCodeScreen
          code="KWRD"
          availability={{ full: false, takenAvatarIds: [] }}
          onContinue={onContinue}
          onScanQr={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    await fireEvent.press(result.getByRole('button', { name: 'Continue to pick your vibe' }));
    expect(onContinue).toHaveBeenCalledWith('KWRD');
  });

  it('keeps QR entry available from the manual route', async () => {
    const onScanQr = jest.fn();
    const result = await render(
      <SafeAreaProvider initialMetrics={STANDARD_METRICS}>
        <RoomCodeScreen
          code=""
          availability={undefined}
          onContinue={jest.fn()}
          onScanQr={onScanQr}
        />
      </SafeAreaProvider>,
    );

    await fireEvent.press(result.getByRole('button', { name: 'Scan TV room QR code' }));
    expect(onScanQr).toHaveBeenCalledTimes(1);
  });
});
