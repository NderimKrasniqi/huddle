import { settingsFrom } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import { CURATED_PROMPTS } from './prompts';
import { ROUND_COUNTS, VOTING_SETTINGS_SCHEMA, votingSettings } from './settings';

/**
 * The settings are declared as data the hub reads without understanding, so what
 * is tested here is the far side of that seam: that the game reads the Host's
 * strings back as its own one setting, and that the schema never offers a game
 * longer than the prompt list can deal.
 */
describe('the Voting settings', () => {
  it('reads the Host’s chosen round count', () => {
    expect(votingSettings({ rounds: '5' }).rounds).toBe(5);
  });

  it('defaults an unset or unoffered choice rather than throwing', () => {
    expect(votingSettings(undefined).rounds).toBe(3);
    expect(votingSettings({ rounds: '99' }).rounds).toBe(3);
  });

  it('offers no game longer than the Curated Prompts can deal', () => {
    for (const option of VOTING_SETTINGS_SCHEMA[0]?.options ?? []) {
      expect(Number(option.value)).toBeLessThanOrEqual(CURATED_PROMPTS.length);
    }
  });

  it('offers every round count the game supports', () => {
    const offered = (VOTING_SETTINGS_SCHEMA[0]?.options ?? []).map((option) => Number(option.value));

    expect(offered).toEqual(ROUND_COUNTS.filter((count) => count <= CURATED_PROMPTS.length));
  });

  it('defaults to a value it actually offers', () => {
    // The invariant the Registry checks generically, asserted here at the source
    // so a change to the default that fell outside the options fails close by.
    const rounds = VOTING_SETTINGS_SCHEMA[0];
    const offered = rounds?.options.map((option) => option.value) ?? [];

    expect(offered).toContain(rounds?.defaultValue);
  });

  it('settles to the schema default through the hub’s own helper', () => {
    // `settingsFrom` is what `startGame` calls; it must produce a value the game
    // then reads back to a real round count.
    const settled = settingsFrom(VOTING_SETTINGS_SCHEMA, undefined);

    expect(votingSettings(settled).rounds).toBe(3);
  });
});
