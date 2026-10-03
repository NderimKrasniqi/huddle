import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PhoneFrame } from './phone-frame';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

// fireEvent already wraps each event in act, so these are awaited, never nested.
async function scrollTo(scroll: ReturnType<typeof screen.getByTestId>, { viewport, content, offset }: { viewport: number; content: number; offset: number }) {
  await fireEvent(scroll, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: viewport } } });
  await fireEvent(scroll, 'contentSizeChange', 390, content);
  await fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: offset }, contentSize: { width: 390, height: content }, layoutMeasurement: { width: 390, height: viewport } } });
}

describe('PhoneFrame', () => {
  it('fades content into the footer only while more of it is below', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <PhoneFrame footer={<Text>Set up Trivia</Text>} testID="frame">
          <Text>Games</Text>
        </PhoneFrame>
      </SafeAreaProvider>,
    );
    const scroll = screen.getByTestId('phone-frame-scroll');
    expect(screen.queryByTestId('phone-footer-fade')).toBeNull();

    await scrollTo(scroll, { viewport: 600, content: 900, offset: 0 });
    expect(screen.getByTestId('phone-footer-fade')).toBeTruthy();

    // Scrolled to the end, nothing is hidden any more.
    await scrollTo(scroll, { viewport: 600, content: 900, offset: 300 });
    expect(screen.queryByTestId('phone-footer-fade')).toBeNull();
  });

  it('never fades content that fits', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <PhoneFrame footer={<Text>Start</Text>}>
          <Text>Short</Text>
        </PhoneFrame>
      </SafeAreaProvider>,
    );
    await scrollTo(screen.getByTestId('phone-frame-scroll'), { viewport: 600, content: 400, offset: 0 });

    expect(screen.queryByTestId('phone-footer-fade')).toBeNull();
  });
});
