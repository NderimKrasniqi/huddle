import { render, screen } from '@testing-library/react-native';

import { PhoneLoadingScreen } from './loading-screen';

describe('PhoneLoadingScreen', () => {
  it('announces session restoration through the loading surface', async () => {
    render(<PhoneLoadingScreen phase="restoring" />);

    expect(await screen.findByText('Finding your room')).toBeTruthy();
  });
});
