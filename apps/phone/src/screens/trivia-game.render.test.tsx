import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { GameEvent, GamePlayer } from '@huddle/domain';
import { CAROUSEL_REGISTRY } from '@huddle/game-registry';
import { StyleSheet } from 'react-native';

const trivia = CAROUSEL_REGISTRY.find((module) => module.metadata.id === 'trivia');

if (trivia === undefined) {
  throw new Error('Trivia must be installed for its render coverage.');
}

const triviaModule = trivia;

const player: GamePlayer = {
  playerId: 'ada',
  nickname: 'Ada',
  away: false,
  avatar: 'fox',
};

const players: readonly GamePlayer[] = [
  player,
  { playerId: 'bo', nickname: 'Bo', away: false, avatar: 'teal-bear' },
];

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
  answers: {},
  answerSeconds: {},
  standings: players.map(({ playerId }) => ({ playerId, score: 0 })),
  scoring: 'flat' as const,
};

const lockedState = {
  ...questionState,
  answers: { ada: 1 },
  answerSeconds: { ada: 18 },
};

const revealState = {
  ...lockedState,
  phase: 'reveal' as const,
};

function PhoneTrivia({
  state,
  sendEvent,
  clockRemainingMs,
  hostChromeInsetTop,
}: {
  readonly state: unknown;
  readonly sendEvent: (event: GameEvent) => void;
  readonly clockRemainingMs?: number;
  readonly hostChromeInsetTop?: number;
}) {
  return triviaModule.screens.phone({
    state,
    player,
    sendEvent,
    safeAreaInsets: { top: 47, right: 11, bottom: 34, left: 13 },
    hostChromeInsetTop,
    clockRemainingMs,
  });
}

function renderPhone(
  state: unknown,
  sendEvent: (event: GameEvent) => void = jest.fn(),
  hostChromeInsetTop?: number,
) {
  return render(
    <PhoneTrivia
      state={state}
      sendEvent={sendEvent}
      clockRemainingMs={17_500}
      hostChromeInsetTop={hostChromeInsetTop}
    />,
  );
}

describe('Trivia Phone game renderer', () => {
  afterEach(() => cleanup());

  it('keeps answer controls on the owner phone and sends one native answer action', async () => {
    const sendEvent = jest.fn();
    const result = await renderPhone(questionState, sendEvent);

    expect(result.getByText('Which color is on the Huddle board?')).toBeTruthy();
    expect(result.getByTestId('trivia-phone-clock')).toBeTruthy();
    expect(result.getAllByRole('button')).toHaveLength(4);
    expect(result.getByText('Your choice stays on this phone until the reveal.')).toBeTruthy();

    await fireEvent.press(result.getByTestId('trivia-answer-1'));
    expect(sendEvent).toHaveBeenCalledWith({
      kind: 'answer',
      playerId: 'ada',
      questionIndex: 0,
      optionIndex: 1,
    });
  });

  it('renders a distinct private waiting state after the owner locks an answer', async () => {
    const result = await renderPhone({ ...lockedState, participationCount: 1 });

    expect(result.getByTestId('trivia-phone-waiting-after-answer')).toBeTruthy();
    expect(result.getByText('1 of 2 answered')).toBeTruthy();
    expect(result.getByText('Waiting for others…')).toBeTruthy();
    expect(result.queryByText('Which color is on the Huddle board?')).toBeNull();
    expect(result.queryAllByRole('button')).toHaveLength(0);

    await act(async () => {
      result.rerender(
        <PhoneTrivia state={revealState} sendEvent={jest.fn()} />,
      );
    });

    expect(result.getByText('Eyes up.')).toBeTruthy();
    expect(result.queryAllByRole('button')).toHaveLength(0);
    expect(result.queryByText('Correct')).toBeNull();
  });

  it('reserves platform Host chrome and both horizontal safe-area insets', async () => {
    const result = await renderPhone(questionState, jest.fn(), 64);
    const scrollStyle = StyleSheet.flatten(result.getByTestId('trivia-phone-scroll').props.contentContainerStyle);

    expect(scrollStyle).toMatchObject({
      paddingLeft: 13,
      paddingRight: 11,
      paddingTop: 47 + 64 + 16,
      paddingBottom: 34 + 24,
    });
  });

  it('derives a new question countdown synchronously instead of flashing the prior beat', async () => {
    const nextQuestionState = {
      ...questionState,
      questions: [question, { ...question, text: 'Which shape is Huddle?' }],
      questionIndex: 1,
    };
    const result = await render(
      <PhoneTrivia state={questionState} sendEvent={jest.fn()} clockRemainingMs={17_500} />,
    );

    expect(result.getByText('18s')).toBeTruthy();
    await act(async () => {
      result.rerender(
        <PhoneTrivia state={nextQuestionState} sendEvent={jest.fn()} clockRemainingMs={4_500} />,
      );
    });

    expect(result.getByText('5s')).toBeTruthy();
    expect(result.queryByText('18s')).toBeNull();
  });

  it('crops the finished portrait artwork into its status surface', async () => {
    const result = await renderPhone({ ...revealState, phase: 'finished' });

    expect(result.getByTestId('trivia-phone-finished-art').props.resizeMode).toBe('cover');
    expect(result.queryByTestId('trivia-phone-status-art')).toBeNull();
  });
});
