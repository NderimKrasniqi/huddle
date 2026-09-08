import { describe, expect, it } from 'vitest';

import {
  votingSettings,
  VOTING_SETTINGS_PRESENTATION,
  VOTING_SETTINGS_SCHEMA,
} from './settings';

describe('Voting settings', () => {
  it('declares the four researched controls and all approved values', () => {
    expect(VOTING_SETTINGS_SCHEMA.map(({ key }) => key)).toEqual([
      'rounds',
      'voteSeconds',
      'results',
      'voterLabels',
    ]);
    expect(VOTING_SETTINGS_SCHEMA[0]?.options.map(({ value }) => value)).toEqual(['3', '5', '7']);
    expect(VOTING_SETTINGS_SCHEMA[1]?.options.map(({ value }) => value)).toEqual(['15', '30', '45', 'none']);
    expect(VOTING_SETTINGS_SCHEMA[2]?.options.map(({ value }) => value)).toEqual(['together', 'live']);
    expect(VOTING_SETTINGS_SCHEMA[3]?.options.map(({ value }) => value)).toEqual(['hidden', 'afterReveal']);
  });

  it('settles Standard defaults and the complete Quick preset', () => {
    expect(votingSettings(undefined)).toEqual({
      rounds: 5,
      voteSeconds: 30,
      results: 'together',
      voterLabels: 'hidden',
    });
    expect(VOTING_SETTINGS_PRESENTATION.presets[0]?.settings).toEqual({
      rounds: '3',
      voteSeconds: '15',
      results: 'together',
      voterLabels: 'hidden',
    });
  });

  it('resolves every custom setting without inventing values', () => {
    expect(votingSettings({
      rounds: '7',
      voteSeconds: 'none',
      results: 'live',
      voterLabels: 'afterReveal',
    })).toEqual({
      rounds: 7,
      voteSeconds: 'none',
      results: 'live',
      voterLabels: 'afterReveal',
    });
  });
});
