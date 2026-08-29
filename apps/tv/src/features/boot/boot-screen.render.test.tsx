import { render, screen } from '@testing-library/react-native';

import { TvBootScreen } from './boot-screen';

describe('TvBootScreen', () => {
  it.each([
    ['startup', 'Starting Huddle…', 'Getting things ready'],
    ['opening', 'Creating your room…', 'Setting things up'],
    ['reconnecting', 'Reconnecting to room…', 'Getting everyone back'],
  ] as const)('renders the animated %s phase with phase copy', async (phase, title, subtitle) => {
    await render(<TvBootScreen phase={phase} />);

    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByText(subtitle)).toBeTruthy();
    expect(screen.getByTestId('tv-boot-background')).toBeTruthy();
    expect(screen.getByTestId('tv-boot-animated').props.focusable).toBe(false);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });

  it.each([
    ['misconfigured', 'TV setup required'],
    ['deviceFailure', 'TV unavailable'],
  ] as const)('keeps %s as the exact legible purpose label', async (phase, purpose) => {
    await render(<TvBootScreen phase={phase} />);

    expect(await screen.findByText(purpose)).toBeTruthy();
    expect(screen.queryByTestId('tv-boot-animated')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
  });
});
