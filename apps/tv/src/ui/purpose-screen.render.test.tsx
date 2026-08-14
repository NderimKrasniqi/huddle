import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PurposeScreen } from '@huddle/ui/native';

describe('PurposeScreen on TV', () => {
  it('renders one accessible label and no TV-focusable surface', async () => {
    await render(<PurposeScreen platform="tv" purpose="Room invitation" />);

    const label = screen.getByRole('text');

    expect(screen.getAllByText('Room invitation')).toHaveLength(1);
    expect(screen.getAllByRole('text')).toHaveLength(1);
    expect(label.props.accessibilityLabel).toBe('Room invitation');
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      color: '#000000',
      fontSize: 48,
      textAlign: 'center',
    });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});
