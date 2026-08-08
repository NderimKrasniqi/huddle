import type { GamePlayer } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { votingGameLogic, type VotingState } from './logic';
import { voteScreen } from './voting-controller';

/**
 * The Vote Screen decides which taps a phone offers, so it is tested against the
 * same rules the reducer enforces — the screen's job is to offer exactly what
 * the reducer would accept, so that the refusals in `logic.ts` are a floor
 * nobody is standing on.
 */

function player(id: string, away = false): GamePlayer {
  return { playerId: id, nickname: id.toUpperCase(), away, avatar: 'fox' };
}

function started(playerIds: string[]): VotingState {
  return votingGameLogic.createInitialState({
    players: playerIds.map((id) => player(id)),
    settings: { rounds: '3' },
  });
}

describe('the Vote Screen', () => {
  it('offers the prompt’s options, all open, before this player votes', () => {
    const screen = voteScreen(started(['a', 'b']), 'a');

    expect(screen.kind).toBe('prompt');
    if (screen.kind !== 'prompt') return;

    expect(screen.promptIndex).toBe(0);
    expect(screen.voted).toBe(false);
    expect(screen.options.every((option) => option.state === 'open')).toBe(true);
  });

  it('closes every option once this player’s ballot is in, naming none of them', () => {
    const voted = votingGameLogic.reduce(started(['a', 'b']), {
      kind: 'vote',
      playerId: 'a',
      promptIndex: 0,
      optionIndex: 1,
    });
    const screen = voteScreen(voted, 'a');

    expect(screen.kind).toBe('prompt');
    if (screen.kind !== 'prompt') return;

    expect(screen.voted).toBe(true);
    // Every option closes together — the choice is not known here to single one
    // out, which is exactly the privacy the state keeps.
    expect(screen.options.every((option) => option.state === 'closed')).toBe(true);
  });

  it('leaves a player who has not voted their open buttons while others have', () => {
    const voted = votingGameLogic.reduce(started(['a', 'b']), {
      kind: 'vote',
      playerId: 'a',
      promptIndex: 0,
      optionIndex: 0,
    });
    const screen = voteScreen(voted, 'b');

    expect(screen.kind).toBe('prompt');
    if (screen.kind !== 'prompt') return;

    expect(screen.voted).toBe(false);
    expect(screen.options.every((option) => option.state === 'open')).toBe(true);
  });

  it('sends the eyes to the TV during the reveal', () => {
    const revealed = votingGameLogic.reduce(started(['a', 'b']), {
      kind: 'advance',
      promptIndex: 0,
      phase: 'voting',
    });

    expect(voteScreen(revealed, 'a').kind).toBe('eyesUp');
  });

  it('tells a phone that joined mid-game it is in from the next one', () => {
    const screen = voteScreen(started(['a', 'b']), 'late');

    expect(screen.kind).toBe('eyesUp');
    if (screen.kind !== 'eyesUp') return;

    expect(screen.line).toContain('next game');
  });
});
