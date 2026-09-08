import { cleanup, render } from '@testing-library/react-native';
import type { GamePlayer } from '@huddle/domain';
import { CAROUSEL_REGISTRY } from '@huddle/game-registry';
import { StyleSheet } from 'react-native';

const trivia = CAROUSEL_REGISTRY.find((module) => module.metadata.id === 'trivia');

if (trivia === undefined) {
  throw new Error('Trivia must be installed for its render coverage.');
}

const triviaModule = trivia;

const players: readonly GamePlayer[] = [
  { playerId: 'ada', nickname: 'Ada', away: false, avatar: 'fox' },
  { playerId: 'bo', nickname: 'Bo', away: false, avatar: 'teal-bear' },
];

const tenPlayers: readonly GamePlayer[] = Array.from({ length: 10 }, (_, index) => ({
  playerId: `player-${index + 1}`,
  nickname: `Player ${index + 1}`,
  away: false,
  avatar: 'fox' as const,
}));

const question = {
  text: 'Which color is on the Huddle board?',
  options: ['Coral', 'Espresso', 'Mint', 'Lilac'] as const,
  correctIndex: 1,
};

const questionState = {
  questions: [question],
  questionIndex: 0,
  questionSeconds: 20,
  phase: 'question' as const,
  // The TV receives only an aggregate, never live answer-player keys.
  answers: {},
  participationCount: 1,
  answerSeconds: undefined,
  standings: players.map(({ playerId }) => ({ playerId, score: 0 })),
  scoring: 'flat' as const,
};

const revealState = {
  ...questionState,
  phase: 'reveal' as const,
  answers: {},
  participationCount: undefined,
  questions: [{ ...question, correctIndex: 1 }],
  revealVerdicts: { ada: true, bo: false },
};

const tenPlayerRevealState = {
  ...revealState,
  standings: tenPlayers.map(({ playerId }, index) => ({ playerId, score: index === 0 ? 100 : 0 })),
  revealVerdicts: Object.fromEntries(tenPlayers.map(({ playerId }, index) => [playerId, index === 0])),
};

function TvTrivia({
  state,
  players: stagePlayers = players,
}: {
  readonly state: unknown;
  readonly players?: readonly GamePlayer[];
}) {
  return triviaModule.screens.tv({ state, players: stagePlayers, clockRemainingMs: 17_500 });
}

describe('Trivia TV game renderer', () => {
  afterEach(() => cleanup());

  it('shows the shared prompt and neutral participation without TV controls or private choice copy', async () => {
    const result = await render(<TvTrivia state={questionState} />);

    expect(result.getByTestId('trivia-tv-screen').props.pointerEvents).toBe('none');
    expect(result.getByText('Which color is on the Huddle board?')).toBeTruthy();
    expect(result.getByLabelText(/Question 1 of 1.*Choices: A: Coral; B: Espresso; C: Mint; D: Lilac/)).toBeTruthy();
    expect(result.getByText('1/2 answered')).toBeTruthy();
    expect(result.queryAllByRole('button')).toHaveLength(0);
    expect(result.queryByText('Ada chose Espresso')).toBeNull();
    expect(result.queryByText('Correct')).toBeNull();
  });

  it('reveals only the shared answer and standings, still with no focus targets', async () => {
    const result = await render(<TvTrivia state={revealState} />);

    expect(result.getByText('Here’s the answer')).toBeTruthy();
    expect(result.getByText('Espresso')).toBeTruthy();
    expect(result.getByLabelText(/Reveal for question 1 of 1.*B: Espresso, correct answer.*Round results: Ada, Correct, 0 points; Bo, Missed, 0 points/)).toBeTruthy();
    expect(result.getAllByText('Correct')).toHaveLength(2);
    expect(result.getByText('Ada')).toBeTruthy();
    expect(result.getByText('Round results')).toBeTruthy();
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps ten-player reveal outcomes inside a compact two-column stage', async () => {
    const result = await render(
      <TvTrivia state={tenPlayerRevealState} players={tenPlayers} />,
    );
    const grid = StyleSheet.flatten(result.getByTestId('trivia-tv-verdict-grid').props.style);

    expect(grid).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(result.getAllByTestId(/trivia-tv-verdict-row-/)).toHaveLength(10);
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps ten-player final standings inside the compact overscan-safe grid', async () => {
    const finishedState = {
      ...tenPlayerRevealState,
      phase: 'finished' as const,
      answers: {},
      revealVerdicts: undefined,
    };
    const result = await render(
      <TvTrivia state={finishedState} players={tenPlayers} />,
    );
    const grid = StyleSheet.flatten(result.getByTestId('trivia-tv-final-grid').props.style);

    expect(grid).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(result.getAllByTestId(/trivia-tv-final-row-/)).toHaveLength(10);
    expect(result.getByLabelText(/Final Trivia standings:.*Player 1, 100 points, winner.*Player 2, 0 points/)).toBeTruthy();
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps a two-player podium compact while leaving every result visible', async () => {
    const finishedState = {
      ...revealState,
      phase: 'finished' as const,
      standings: [
        { playerId: 'ada', score: 200 },
        { playerId: 'bo', score: 0 },
      ],
      revealVerdicts: undefined,
    };
    const result = await render(<TvTrivia state={finishedState} />);
    const winnerStyle = StyleSheet.flatten(result.getByTestId('trivia-tv-final-row-ada').props.style);
    const runnerUpStyle = StyleSheet.flatten(result.getByTestId('trivia-tv-final-row-bo').props.style);

    expect(winnerStyle.height).toBeGreaterThanOrEqual(272);
    expect(runnerUpStyle.height).toBeGreaterThanOrEqual(272);
    expect(result.getByText('Ada')).toBeTruthy();
    expect(result.getByText('200')).toBeTruthy();
    expect(result.getByText('Bo')).toBeTruthy();
    expect(result.getByText('0')).toBeTruthy();
  });
});
