import { act, cleanup, render, screen } from '@testing-library/react-native';

import { TvGameCarouselScreen } from './game-carousel-screen';
import { TvSelectedGameArtScreen } from './game-art-reveal-screen';
import { TvGameSetupScreen } from './game-setup-screen';

const trivia = [
  { key: 'questions', label: 'Questions', options: [{ value: '10', label: '10' }], defaultValue: '10', icon: 'count', unit: 'questions' },
] as const;

describe('TV game flow renderers', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('shows three game cards around the one the host is on, with no controls', async () => {
    await render(<TvGameCarouselScreen hostName="Ada" selectedGameId="voting" reduceMotion />);
    expect(screen.getByTestId('tv-game-flow-background')).toBeTruthy();
    expect(screen.getByTestId('tv-game-card-voting').props.focusable).toBe(false);
    expect(screen.getByLabelText('Voting, selected')).toBeTruthy();
    expect(screen.getByTestId('tv-game-card-trivia')).toBeTruthy();
    expect(screen.getByTestId('tv-game-card-doodle-dash')).toBeTruthy();
    expect(screen.getByText('Ada is choosing a game.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('stops the card window at the end of the catalogue instead of wrapping', async () => {
    await render(<TvGameCarouselScreen selectedGameId="hot-take" reduceMotion />);
    expect(screen.getByTestId('tv-game-card-doodle-dash')).toBeTruthy();
    expect(screen.getByTestId('tv-game-card-quick-poll')).toBeTruthy();
    expect(screen.getByLabelText('Hot Take, coming soon, selected')).toBeTruthy();
    expect(screen.queryByTestId('tv-game-card-trivia')).toBeNull();
  });

  it('reveals the chosen game before setup', async () => {
    await render(<TvSelectedGameArtScreen gameId="voting" hostName="Ada" reduceMotion />);
    expect(screen.getByText('Let’s play Voting!')).toBeTruthy();
    expect(screen.getByLabelText('Voting selected. Ada is choosing settings on the phone.')).toBeTruthy();
  });

  it('shows only the settings the game declared while the host configures', async () => {
    await render(
      <TvGameSetupScreen
        gameId="trivia"
        gameTitle="Trivia"
        hostName="Ada"
        mode="custom"
        stage="configuring"
        settings={{ questions: '10', difficulty: 'hard' }}
        settingsSchema={trivia}
        players={[{ id: 'ada', name: 'Ada', isHost: true }]}
        reduceMotion
      />,
    );
    expect(screen.getByText('Setting up Trivia')).toBeTruthy();
    expect(screen.getByLabelText('Questions: 10')).toBeTruthy();
    expect(screen.queryByTestId('tv-game-setting-difficulty')).toBeNull();
    expect(screen.getByLabelText('Custom setup')).toBeTruthy();
    expect(screen.queryByText(/hands up/i)).toBeNull();
  });

  it('counts raised hands and names who the room is waiting for', async () => {
    await render(
      <TvGameSetupScreen
        gameId="trivia"
        hostName="Ada"
        stage="ready"
        settings={{ questions: '10' }}
        settingsSchema={trivia}
        players={[
          { id: 'ada', name: 'Ada', isHost: true },
          { id: 'bo', name: 'Bo' },
        ]}
        readyPlayerIds={['ada']}
        reduceMotion
      />,
    );
    expect(screen.getByText('Hands up for Trivia!')).toBeTruthy();
    expect(screen.getByText('Trivia · 10 questions')).toBeTruthy();
    expect(screen.getByText('1 of 2 hands up')).toBeTruthy();
    expect(screen.getByText('Waiting for Bo')).toBeTruthy();
    expect(screen.getByLabelText('Ada, host, ready')).toBeTruthy();
    expect(screen.getByLabelText('Bo')).toBeTruthy();
  });

  it('tells the room the host can start once every hand is up', async () => {
    await render(
      <TvGameSetupScreen
        gameId="trivia"
        hostName="Ada"
        stage="ready"
        players={[
          { id: 'ada', name: 'Ada', isHost: true },
          { id: 'bo', name: 'Bo' },
        ]}
        readyPlayerIds={['ada', 'bo']}
        reduceMotion
      />,
    );
    expect(screen.getByText('Every hand is up!')).toBeTruthy();
    expect(screen.getByText('Ada can start the game')).toBeTruthy();
  });

  it('does not claim an away player is ready', async () => {
    await render(
      <TvGameSetupScreen
        gameId="voting"
        settings={{ rounds: '3' }}
        stage="ready"
        players={[{ id: 'away', name: 'Away', away: true }]}
        readyPlayerIds={['away']}
        reduceMotion
      />,
    );
    expect(screen.queryByText('Every hand is up!')).toBeNull();
    expect(screen.getByLabelText('0 of 1 players are ready')).toBeTruthy();
    expect(screen.getByLabelText('Away, away')).toBeTruthy();
  });

  it('counts down to the server deadline on the TV clock', async () => {
    jest.useFakeTimers({ now: 10_000 });
    await render(
      <TvGameSetupScreen
        gameId="trivia"
        stage="countdown"
        countdownEndsAt={13_000}
        players={[{ id: 'ada', name: 'Ada', isHost: true }]}
        reduceMotion
      />,
    );
    expect(screen.getByLabelText('Trivia starts in 3')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(3_200);
    });
    expect(screen.getByLabelText('Trivia is starting')).toBeTruthy();
  });

  it('keeps the ready check up if a countdown arrives without its deadline', async () => {
    await render(
      <TvGameSetupScreen
        gameId="trivia"
        stage="countdown"
        players={[{ id: 'ada', name: 'Ada', isHost: true }]}
        readyPlayerIds={['ada']}
        reduceMotion
      />,
    );
    expect(screen.getByText('Hands up for Trivia!')).toBeTruthy();
  });
});
