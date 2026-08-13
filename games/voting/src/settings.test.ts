import { describe, expect, it } from 'vitest';
import { votingSettings, VOTING_SETTINGS_SCHEMA } from './settings';
describe('Voting proof settings', () => { it('offers only three or five rounds', () => { expect(VOTING_SETTINGS_SCHEMA[0]?.options.map(({ value }) => value)).toEqual(['3', '5']); expect(votingSettings({ rounds: '5' })).toEqual({ rounds: 5 }); }); });
