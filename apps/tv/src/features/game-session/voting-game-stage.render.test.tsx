import { cleanup, render } from '@testing-library/react-native';
import type { GamePlayer } from '@huddle/domain';
import { CAROUSEL_REGISTRY } from '@huddle/game-registry';
import { StyleSheet } from 'react-native';

const voting = CAROUSEL_REGISTRY.find((module) => module.metadata.id === 'voting');
if (voting === undefined) throw new Error('Voting must be installed for render coverage.');
const votingModule = voting;

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
const prompt = { text: 'Best movie-night snack?', options: ['Popcorn', 'Pizza', 'Candy', 'Nachos'] as const };
const liveState = {
  prompts: [prompt],
  roundIndex: 0,
  phase: 'vote' as const,
  voteSeconds: 30 as const,
  results: 'live' as const,
  voterLabels: 'hidden' as const,
  playerIds: ['ada', 'bo'],
  votes: {},
  history: [],
  participationCount: 2,
  tally: [1, 1, 0, 0] as const,
};

function TvVoting({ state, stagePlayers = players }: { readonly state: unknown; readonly stagePlayers?: readonly GamePlayer[] }) {
  return votingModule.screens.tv({ state, players: stagePlayers, clockRemainingMs: 12_500 });
}

describe('Voting TV game renderer', () => {
  afterEach(() => cleanup());

  it('shows aggregate live results with no controls or player-to-choice copy', async () => {
    const result = await render(<TvVoting state={liveState} />);
    expect(result.getByTestId('voting-tv-screen').props.pointerEvents).toBe('none');
    expect(result.getByText('Best movie-night snack?')).toBeTruthy();
    expect(result.getByLabelText(/Round 1 of 1.*Choices: A: Popcorn\. 50%, 1 vote; B: Pizza\. 50%, 1 vote; C: Candy\. 0%, 0 votes; D: Nachos\. 0%, 0 votes/)).toBeTruthy();
    expect(result.getByText('LIVE TALLY')).toBeTruthy();
    expect(result.getAllByText('50%')).toHaveLength(2);
    expect(result.queryAllByRole('button')).toHaveLength(0);
    expect(result.queryByText('Ada voted for Popcorn')).toBeNull();
  });

  it('keeps reveal-together counts hidden until reveal', async () => {
    const result = await render(<TvVoting state={{ ...liveState, results: 'together', tally: undefined }} />);
    expect(result.getByText('REVEAL TOGETHER')).toBeTruthy();
    expect(result.getByLabelText(/Round 1 of 1.*Choices: A: Popcorn\. Waiting for the room; B: Pizza\. Waiting for the room/)).toBeTruthy();
    expect(result.getAllByText('Waiting for the room')).toHaveLength(4);
    expect(result.queryByText('50%')).toBeNull();
  });

  it('shows configured labels only after reveal and compacts ten names', async () => {
    const state = {
      ...liveState,
      phase: 'reveal' as const,
      voterLabels: 'afterReveal' as const,
      playerIds: tenPlayers.map(({ playerId }) => playerId),
      participationCount: 10,
      tally: [10, 0, 0, 0] as const,
      revealedVoters: [tenPlayers.map(({ playerId }) => playerId), [], [], []],
    };
    const result = await render(<TvVoting state={state} stagePlayers={tenPlayers} />);
    expect(result.getByText('NAMES AFTER REVEAL')).toBeTruthy();
    expect(result.getByLabelText(/Reveal for round 1 of 1.*A: Popcorn\. 100%, 10 votes\. Voters: Player 1, Player 2, Player 3, Player 4, Player 5 \+5 more/)).toBeTruthy();
    expect(result.getByTestId('voting-tv-labels-0').props.children).toContain('+5 more');
    const grid = StyleSheet.flatten(result.getByTestId('voting-tv-reveal-grid').props.style);
    expect(grid).toMatchObject({ flexDirection: 'row' });
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });

  it('renders the non-scored room-vibe recap without rankings or winners', async () => {
    const result = await render(<TvVoting state={{
      ...liveState,
      phase: 'finished',
      prompts: [{ text: '', options: ['', '', '', ''] }],
      tally: undefined,
      participationCount: undefined,
      recap: [
        { kind: 'agreement', title: 'Strongest agreement', detail: 'Popcorn brought the room together', value: '4 of 4' },
        { kind: 'closest', title: 'Closest call', detail: 'Pizza and Candy split the room', value: '2–2' },
        { kind: 'wildcard', title: 'Wildcard', detail: 'Nachos surprised the room', value: '1 vote' },
      ],
    }} />);
    expect(result.getByText('That’s the room’s vibe')).toBeTruthy();
    expect(result.getByLabelText(/Voting recap.*Strongest agreement: Popcorn brought the room together\. 4 of 4.*Closest call: Pizza and Candy split the room\. 2–2/)).toBeTruthy();
    expect(result.getByTestId('voting-tv-recap')).toBeTruthy();
    expect(result.queryByText(/wins/i)).toBeNull();
    expect(result.queryByText(/rank/i)).toBeNull();
    expect(result.queryAllByRole('button')).toHaveLength(0);
  });
});
