import { cleanup, render, screen } from '@testing-library/react-native';

import { TvGameCarouselScreen } from './game-carousel-screen';
import { TvSelectedGameArtScreen } from './game-art-reveal-screen';
import { TvGameSetupScreen } from './game-setup-screen';
import { TvReadyToStartScreen } from './game-ready-screen';

describe('TV game flow renderers', () => {
  afterEach(() => cleanup());

  it('renders the four display-only stages without controls or focus targets', async () => {
    await render(
      <TvGameCarouselScreen hostName="Ada" selectedGameId="voting" reduceMotion />,
    );
    expect(screen.getByTestId('tv-game-flow-background')).toBeTruthy();
    expect(screen.getByTestId('tv-game-card-voting')).toBeTruthy();
    expect(screen.getByTestId('tv-game-card-voting').props.focusable).toBe(false);
    expect(screen.getByText('Ada is choosing a game.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('masks the supplied Voting artwork badges during game-art reveal', async () => {
    await render(
      <TvSelectedGameArtScreen gameId="voting" hostName="Ada" reduceMotion />,
    );
    expect(screen.getByTestId('tv-game-art-voting')).toBeTruthy();
    expect(screen.getByTestId('tv-voting-art-badge-mask')).toBeTruthy();
    expect(screen.queryByText('12 Players')).toBeNull();
  });

  it('renders only supplied authoritative settings and mirrors all-ready state', async () => {
    await render(
      <TvGameSetupScreen
        gameId="trivia"
        hostName="Ada"
        mode="standard"
        stage="ready"
        settings={{ questions: '10', difficulty: 'hard' }}
        players={[
          { id: 'ada', name: 'Ada', isHost: true },
          { id: 'bo', name: 'Bo' },
        ]}
        readyPlayerIds={['ada', 'bo']}
      />,
    );
    expect(screen.getByTestId('tv-game-setting-questions')).toBeTruthy();
    expect(screen.queryByTestId('tv-game-setting-difficulty')).toBeNull();
    expect(screen.getByText('Everyone is ready!')).toBeTruthy();
    expect(screen.getByLabelText('Ada, host, ready')).toBeTruthy();
    expect(screen.getByLabelText('Bo, ready')).toBeTruthy();
  });

  it('does not claim an away player is ready', async () => {
    await render(
      <TvGameSetupScreen
        gameId="voting"
        settings={{ rounds: '3' }}
        players={[{ id: 'away', name: 'Away', away: true }]}
        readyPlayerIds={['away']}
      />,
    );
    expect(screen.queryByText('Everyone is ready!')).toBeNull();
    expect(screen.getByText('0 of 1 players are ready')).toBeTruthy();
  });

  it('keeps ready copy display-only and renders the room code', async () => {
    await render(
      <TvReadyToStartScreen
        gameId="trivia"
        hostName="Ada"
        roomCode="KWRD"
        reduceMotion
      />,
    );
    expect(screen.getByTestId('tv-game-ready-check')).toBeTruthy();
    expect(screen.getByText('Everyone is ready!')).toBeTruthy();
    expect(screen.getByText('Room KWRD')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByTestId('tv-game-ready').props.pointerEvents).toBe('none');
  });
});
