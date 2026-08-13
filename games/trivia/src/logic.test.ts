import { describe, expect, it } from 'vitest';
import { triviaGameLogic } from './logic';

describe('Trivia launch proof', () => {
  it('enters with resolved settings and has no deadline', () => {
    const state = triviaGameLogic.createInitialState({ players: [], settings: { questions: '5' } });
    expect(state).toEqual({ phase: 'entered', resolvedSettings: { questions: 5 } });
    expect(triviaGameLogic.deadline).toBeUndefined();
    expect(() => triviaGameLogic.decodeEvent({ kind: 'answer' })).toThrow('no player events');
  });
});
