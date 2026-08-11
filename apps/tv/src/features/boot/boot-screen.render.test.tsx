import { render, screen } from '@testing-library/react-native';

import { TvBootScreen } from './boot-screen';

describe('TvBootScreen', () => {
  it('renders a recovery message before a safe room exists', async () => {
    render(<TvBootScreen phase="reconnecting" />);

    expect(await screen.findByText('Reconnecting to Huddle')).toBeTruthy();
  });
});
