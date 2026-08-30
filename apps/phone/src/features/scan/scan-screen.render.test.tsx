import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ScanScreen } from './scan-screen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRequestPermission = jest.fn(() =>
  Promise.resolve({ granted: true, canAskAgain: true }),
);
let mockCameraPermission: { granted: boolean; canAskAgain: boolean } | null = {
  granted: true,
  canAskAgain: true,
};
let mockFocused = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack }),
  useIsFocused: () => mockFocused,
}));

jest.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return React.createElement(View, props);
  },
  useCameraPermissions: () => [mockCameraPermission, mockRequestPermission],
}));

describe('ScanScreen', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockBack.mockClear();
    mockRequestPermission.mockClear();
    mockCameraPermission = { granted: true, canAskAgain: true };
    mockFocused = true;
  });

  it('requests permission once after denial and leaves retry explicit', async () => {
    mockCameraPermission = { granted: false, canAskAgain: true };
    const result = await render(<ScanScreen />);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    // Expo returns a new permission response after the request. A denial must
    // not trigger another automatic prompt from that response update.
    mockCameraPermission = { granted: false, canAskAgain: true };
    await act(async () => {
      result.rerender(<ScanScreen />);
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    fireEvent.press(result.getByLabelText('Try camera permission again'));
    expect(mockRequestPermission).toHaveBeenCalledTimes(2);
  });

  it('allows one fresh automatic request after leaving and re-entering the route', async () => {
    mockCameraPermission = { granted: false, canAskAgain: true };
    const result = await render(<ScanScreen />);

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    // Focus changes are the only automatic reset boundary.
    mockFocused = false;
    await act(async () => {
      result.rerender(<ScanScreen />);
    });
    mockFocused = true;
    mockCameraPermission = { granted: false, canAskAgain: true };
    await act(async () => {
      result.rerender(<ScanScreen />);
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(2);
  });

  it('mounts a rear camera in QR-only mode', async () => {
    const result = await render(<ScanScreen />);
    const camera = result.getByTestId('qr-camera-view');

    expect(camera.props.facing).toBe('back');
    expect(camera.props.active).toBe(true);
    expect(camera.props.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
  });

  it('offers Settings when camera permission cannot be requested again', async () => {
    mockCameraPermission = { granted: false, canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    try {
      const result = await render(<ScanScreen />);

      expect(mockRequestPermission).not.toHaveBeenCalled();
      await fireEvent.press(result.getByLabelText('Open camera settings'));
      expect(openSettings).toHaveBeenCalledTimes(1);
    } finally {
      openSettings.mockRestore();
    }
  });

  it('falls back to manual entry when the native camera fails to mount', async () => {
    const result = await render(<ScanScreen />);

    await act(async () => {
      fireEvent(result.getByTestId('qr-camera-view'), 'onMountError', new Error('camera unavailable'));
    });

    const errorCard = result.getByTestId('scanner-error-card');
    expect(within(errorCard).getByLabelText('Enter room code manually')).toBeTruthy();
    expect(result.queryByTestId('qr-camera-view')).toBeNull();
  });

  it('unmounts the camera preview when the scanner route loses focus', async () => {
    const result = await render(<ScanScreen />);

    mockFocused = false;
    await act(async () => {
      result.rerender(<ScanScreen />);
    });

    expect(result.queryByTestId('qr-camera-view')).toBeNull();
  });

  it('keeps scanning after a malformed payload', async () => {
    const result = await render(<ScanScreen />);

    await fireEvent(result.getByTestId('qr-camera-view'), 'onBarcodeScanned', {
      data: 'https://example.com/room/KWRD',
    });

    expect(result.getByTestId('scanner-message')).toHaveTextContent(
      'That QR code is not a Huddle room code. Keep scanning.',
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('locks accepted scans and replaces the route with the normalized code', async () => {
    const result = await render(<ScanScreen />);
    const camera = result.getByTestId('qr-camera-view');

    await fireEvent(camera, 'onBarcodeScanned', { data: 'huddle://join/kwrd' });
    await fireEvent(camera, 'onBarcodeScanned', { data: 'huddle://join/ABCD' });

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/join/KWRD');
  });

  it('returns to the join form from back and manual code actions', async () => {
    const result = await render(<ScanScreen />);

    await act(async () => {
      fireEvent.press(result.getByTestId('scanner-back'));
    });
    await act(async () => {
      fireEvent.press(result.getByTestId('scanner-manual-code'));
    });

    expect(mockBack).toHaveBeenCalledTimes(2);
  });
});
