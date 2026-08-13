import { describe, expect, it } from 'vitest';
import { votingGameLogic } from './logic';
describe('Voting launch proof', () => { it('enters with resolved settings and accepts no events or deadlines', () => { expect(votingGameLogic.createInitialState({ players: [], settings: { rounds: '5' } })).toEqual({ phase: 'entered', resolvedSettings: { rounds: 5 } }); expect(votingGameLogic.deadline).toBeUndefined(); expect(() => votingGameLogic.decodeEvent({ kind: 'vote' })).toThrow('no player events'); }); });
