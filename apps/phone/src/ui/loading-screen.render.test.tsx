import { render, screen } from '@testing-library/react-native';

import { PhoneLoadingScreen } from './loading-screen';

describe('PhoneLoadingScreen', () => {
  it('renders exactly one restoration purpose', async () => {
    await render(<PhoneLoadingScreen phase="restoring" />);

    expect(await screen.findByText('Restoring your room')).toBeTruthy();
    expect(screen.getAllByRole('text')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
  });
});
