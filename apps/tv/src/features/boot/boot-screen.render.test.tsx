import { render, screen } from '@testing-library/react-native';

import { TvBootScreen } from './boot-screen';

describe('TvBootScreen', () => {
  it('renders a recovery message before a safe room exists', async () => {
    await render(<TvBootScreen phase="reconnecting" />);

    expect(await screen.findByText('Reconnecting to Huddle')).toBeTruthy();
  });

  it('renders a device-access failure without implying network retry', async () => {
    await render(<TvBootScreen phase="deviceFailure" />);

    expect(await screen.findByText('Huddle needs device access')).toBeTruthy();
    expect(await screen.findByText(/device storage/i)).toBeTruthy();
  });
});
