import { render, screen } from '@testing-library/react-native';

import { TvBootScreen } from './boot-screen';

describe('TvBootScreen', () => {
  it('renders one neutral recovery purpose', async () => {
    await render(<TvBootScreen phase="reconnecting" />);

    expect(await screen.findByText('Reconnecting to room')).toBeTruthy();
    expect(screen.getAllByRole('text')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('image')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});
