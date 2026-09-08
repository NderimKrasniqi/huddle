import { render, screen } from '@testing-library/react-native';

import { PhoneLoadingScreen } from './loading-screen';

describe('PhoneLoadingScreen', () => {
  it('renders the Heartbeat restoration surface with four orbiting heart elements', async () => {
    await render(<PhoneLoadingScreen phase="restoring" />);

    expect(await screen.findByText('Restoring your room')).toBeTruthy();
    expect(screen.getByTestId('phone-loading-mark')).toBeTruthy();
    expect(screen.getAllByTestId(/phone-loading-mark-heart-/)).toHaveLength(4);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByRole('image', { name: 'Huddle loading' })).toBeTruthy();
  });
});
