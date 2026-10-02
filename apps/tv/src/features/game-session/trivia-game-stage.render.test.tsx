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

const introState = {
  ...questionState,
  phase: 'intro' as const,
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
  clockRemainingMs = 17_500,
}: {
  readonly state: unknown;
  readonly players?: readonly GamePlayer[];
  readonly clockRemainingMs?: number;
}) {
  return triviaModule.screens.tv({ state, players: stagePlayers, clockRemainingMs });
}

describe('Trivia TV game renderer', () => {
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('shows the game-specific start countdown without carrying setup settings into play', async () => {
    // Freeze the clock so a slow machine cannot tick 3 down to 2 mid-test.
    jest.useFakeTimers();
    const result = await render(<TvTrivia state={introState} clockRemainingMs={2_400} />);

    expect(result.getByText('Ready for liftoff?')).toBeTruthy();
    expect(result.getByText('FIRST QUESTION IN')).toBeTruthy();
    expect(result.getByText('3', { includeHiddenElements: true })).toBeTruthy();
    expect(result.getByLabelText(/Trivia countdown.*First question in 3 seconds/)).toBeTruthy();
    expect(result.queryByText('Game settings')).toBeNull();
    expect(result.queryByText('Questions')).toBeNull();
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows the shared prompt and neutral participation without TV controls or private choice copy', async () => {
    const result = await render(<TvTrivia state={questionState} />);

    expect(result.getByTestId('trivia-tv-screen').props.pointerEvents).toBe('none');
    expect(result.getByText('Which color is on the Huddle board?')).toBeTruthy();
    expect(result.getByLabelText(/Question 1 of 1.*Choices: A: Coral; B: Espresso; C: Mint; D: Lilac/)).toBeTruthy();
    expect(result.getByText(' of 2 answered')).toBeTruthy();
    // An older game's questions carry no category, so there is no chip.
    expect(result.queryByTestId('trivia-tv-category')).toBeNull();
    expect(result.queryAllByRole('button')).toHaveLength(0);
    expect(result.queryByText('Ada chose Espresso')).toBeNull();
    expect(result.queryByText('Correct')).toBeNull();
  });

  it('labels the question with its pack category', async () => {
    const withCategory = { ...questionState, questions: questionState.questions.map((asked) => ({ ...asked, category: 'Movies' })) };
    const result = await render(<TvTrivia state={withCategory} />);

    expect(result.getByText('MOVIES', { includeHiddenElements: true })).toBeTruthy();
  });

  it('reveals only the shared answer and standings, still with no focus targets', async () => {
    const result = await render(<TvTrivia state={revealState} />);

    expect(result.getByText('Correct answer')).toBeTruthy();
    expect(result.getByText('Espresso')).toBeTruthy();
    expect(result.getByText('The host can move on sooner')).toBeTruthy();
    expect(result.getByText(' of 2 got it right', { includeHiddenElements: true })).toBeTruthy();
    expect(result.getByLabelText(/Reveal for question 1 of 1.*B: Espresso, correct answer.*Round results: Ada, Correct, 0 points; Bo, Missed, 0 points/)).toBeTruthy();
    expect(result.getAllByText('Correct')).toHaveLength(1);
    expect(result.getAllByText('Missed')).toHaveLength(1);
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
    const rows = result.getAllByTestId(/trivia-tv-verdict-row-/);
    expect(rows).toHaveLength(10);
    // Two 510-wide columns and their gap fit the 1048-wide panel interior.
    expect(StyleSheet.flatten(rows[0]?.props.style)).toMatchObject({ width: 510 });
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('shows all ten final standings: a podium and the rest below', async () => {
    const finishedState = {
      ...tenPlayerRevealState,
      phase: 'finished' as const,
      answers: {},
      revealVerdicts: undefined,
    };
    const result = await render(
      <TvTrivia state={finishedState} players={tenPlayers} />,
    );
    // The top three stand on the podium; everyone else shares the row below.
    expect(result.getByTestId('trivia-tv-final-grid')).toBeTruthy();
    expect(result.getAllByTestId(/trivia-tv-final-row-/)).toHaveLength(10);
    expect(result.getByLabelText(/Final Trivia standings:.*Player 1, 100 points, winner.*Player 2, 0 points/)).toBeTruthy();
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('puts a two-player game on the podium with every result visible', async () => {
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
    expect(result.getByTestId('trivia-tv-final-row-ada')).toBeTruthy();
    expect(result.getByTestId('trivia-tv-final-row-bo')).toBeTruthy();
    expect(result.getByText('Ada wins!')).toBeTruthy();
    expect(result.getByText('Ada')).toBeTruthy();
    expect(result.getByText('200')).toBeTruthy();
    expect(result.getByText('Bo')).toBeTruthy();
    expect(result.getByText('0')).toBeTruthy();
  });
});
