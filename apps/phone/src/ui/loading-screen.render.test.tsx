import { render, screen } from '@testing-library/react-native';

import { PhoneLoadingScreen } from './loading-screen';

describe('PhoneLoadingScreen', () => {
  it('renders the restoring surface with no controls', async () => {
    await render(<PhoneLoadingScreen phase="restoring" />);

    expect(await screen.findByText('Restoring your room')).toBeTruthy();
    expect(screen.getByTestId('phone-restoring-surface')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Huddle' })).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
