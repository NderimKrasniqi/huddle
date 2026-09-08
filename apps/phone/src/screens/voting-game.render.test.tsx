import { act, cleanup, fireEvent, render } from '@testing-library/react-native';
import type { GameEvent, GamePlayer } from '@huddle/domain';
import { CAROUSEL_REGISTRY } from '@huddle/game-registry';
import { StyleSheet } from 'react-native';

const voting = CAROUSEL_REGISTRY.find((module) => module.metadata.id === 'voting');
if (voting === undefined) throw new Error('Voting must be installed for render coverage.');
const votingModule = voting;

const player: GamePlayer = { playerId: 'ada', nickname: 'Ada', away: false, avatar: 'fox' };
const prompt = { text: 'Best movie-night snack?', options: ['Popcorn', 'Pizza', 'Candy', 'Nachos'] as const };
const voteState = {
  prompts: [prompt, { text: '', options: ['', '', '', ''] as const }],
  roundIndex: 0,
  phase: 'vote' as const,
  voteSeconds: 30 as const,
  results: 'together' as const,
  voterLabels: 'hidden' as const,
  playerIds: ['ada', 'bo'],
  votes: {},
  history: [],
};

function PhoneVoting({ state, sendEvent = jest.fn(), clockRemainingMs = 12_500 }: { readonly state: unknown; readonly sendEvent?: (event: GameEvent) => void; readonly clockRemainingMs?: number }) {
  return votingModule.screens.phone({
    state,
    player,
    sendEvent,
    safeAreaInsets: { top: 47, right: 11, bottom: 34, left: 13 },
    hostChromeInsetTop: 64,
    clockRemainingMs,
  });
}

describe('Voting Phone game renderer', () => {
  afterEach(() => cleanup());

  it('keeps all vote controls on the owner phone and sends one locked vote event', async () => {
    const sendEvent = jest.fn();
    const result = await render(<PhoneVoting state={voteState} sendEvent={sendEvent} />);

    expect(result.getByText('Best movie-night snack?')).toBeTruthy();
    expect(result.getAllByRole('button')).toHaveLength(4);
    expect(result.getByText('Your vote stays private on this phone until the shared reveal.')).toBeTruthy();
    await fireEvent.press(result.getByTestId('voting-choice-1'));
    expect(sendEvent).toHaveBeenCalledWith({ kind: 'vote', playerId: 'ada', roundIndex: 0, optionIndex: 1 });
  });

  it('renders a distinct private waiting state after the owner locks a vote', async () => {
    const result = await render(<PhoneVoting state={{ ...voteState, votes: { ada: 1 }, participationCount: 1 }} />);
    expect(result.getByTestId('voting-phone-waiting-after-vote')).toBeTruthy();
    expect(result.getByText('1 of 2 voted')).toBeTruthy();
    expect(result.queryByText('Pizza')).toBeNull();
    expect(result.queryAllByRole('button')).toHaveLength(0);

    await act(async () => {
      result.rerender(<PhoneVoting state={{ ...voteState, phase: 'reveal', prompts: [{ text: '', options: ['', '', '', ''] }] }} />);
    });
    expect(result.getByText('Eyes up!')).toBeTruthy();
    expect(result.queryAllByRole('button')).toHaveLength(0);
    expect(result.queryByText('Pizza')).toBeNull();
  });

  it('respects all safe-area sides and reserves Host platform chrome', async () => {
    const result = await render(<PhoneVoting state={voteState} />);
    const style = StyleSheet.flatten(result.getByTestId('voting-phone-scroll').props.contentContainerStyle);
    expect(style).toMatchObject({
      paddingTop: 47 + 64 + 16,
      paddingRight: 11 + 24,
      paddingBottom: 34 + 24,
      paddingLeft: 13 + 24,
    });
  });

  it('keeps status pages scrollable below Host chrome on a short phone', async () => {
    const result = await render(<PhoneVoting state={{ ...voteState, phase: 'intro' }} />);
    const scroll = result.getByTestId('voting-phone-intro-scroll');
    const style = StyleSheet.flatten(scroll.props.contentContainerStyle);

    expect(scroll.type).toBe('RCTScrollView');
    expect(style).toMatchObject({
      flexGrow: 1,
      paddingTop: 47 + 64 + 24,
      paddingRight: 11 + 24,
      paddingBottom: 34 + 24,
      paddingLeft: 13 + 24,
    });
  });

  it('switches countdown beats synchronously and renders No timer without a countdown', async () => {
    const result = await render(<PhoneVoting state={voteState} clockRemainingMs={12_500} />);
    expect(result.getByText('13s')).toBeTruthy();
    await act(async () => {
      result.rerender(<PhoneVoting state={{ ...voteState, roundIndex: 1, prompts: [{ text: '', options: ['', '', '', ''] }, prompt] }} clockRemainingMs={4_500} />);
    });
    expect(result.getByText('5s')).toBeTruthy();
    expect(result.queryByText('13s')).toBeNull();

    await act(async () => {
      result.rerender(<PhoneVoting state={{ ...voteState, voteSeconds: 'none' }} />);
    });
    expect(result.getByText('NO TIMER')).toBeTruthy();
  });
});
