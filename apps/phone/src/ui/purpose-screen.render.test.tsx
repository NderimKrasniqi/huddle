import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PurposeScreen } from '@huddle/ui/native';

describe('PurposeScreen on Phone', () => {
  it('renders one accessible label and no interactive surface', async () => {
    await render(<PurposeScreen platform="phone" purpose="Join a room" />);

    const label = screen.getByRole('text');

    expect(screen.getAllByText('Join a room')).toHaveLength(1);
    expect(screen.getAllByRole('text')).toHaveLength(1);
    expect(label.props.accessibilityLabel).toBe('Join a room');
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      color: '#000000',
      fontSize: 24,
      textAlign: 'center',
    });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});
