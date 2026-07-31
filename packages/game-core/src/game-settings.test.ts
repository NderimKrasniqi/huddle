import { describe, expect, it } from 'vitest';

import type { GameSettingsSchema } from './game-module';
import { settingsFrom, settingsRefusal } from './game-settings';

/**
 * The hub settling a Host's choices against a schema it cannot read.
 *
 * Every schema here belongs to a game that does not exist, and deliberately: the
 * whole point of this module is that nothing in it knows what a setting means.
 * If any assertion below needed trivia to make sense, the hub would have learnt
 * something about a game.
 */

const coinToss: GameSettingsSchema = [
  {
    key: 'tosses',
    label: 'Tosses',
    options: [
      { value: '1', label: 'One' },
      { value: '3', label: 'Three' },
    ],
    defaultValue: '1',
  },
  {
    key: 'coin',
    label: 'Coin',
    options: [
      { value: 'penny', label: 'Penny' },
      { value: 'pound', label: 'Pound' },
    ],
    defaultValue: 'penny',
  },
];

describe('the settings a game starts with', () => {
  it('is nothing at all for a game that declares no settings', () => {
    expect(settingsFrom([], undefined)).toEqual({});
    expect(settingsFrom([], { tosses: '3' })).toEqual({});
  });

  it('is every setting at its default when the Host chose nothing', () => {
    // What a Host who never opened the settings screen starts a game with.
    expect(settingsFrom(coinToss, undefined)).toEqual({ tosses: '1', coin: 'penny' });
  });

  it('is what the Host chose, with anything they left alone defaulted', () => {
    expect(settingsFrom(coinToss, { tosses: '3' })).toEqual({ tosses: '3', coin: 'penny' });
  });

  it('holds only what the schema declares', () => {
    // A key the game does not offer is a refusal at the mutation
    // (`settingsRefusal`); should one ever reach here it must not travel into
    // the game's own settings, where the module would find a setting it never
    // declared.
    expect(settingsFrom(coinToss, { tosses: '3', weather: 'rain' })).toEqual({
      tosses: '3',
      coin: 'penny',
    });
  });

  it('falls back to the default for a value the setting does not offer', () => {
    expect(settingsFrom(coinToss, { tosses: '7' })).toEqual({ tosses: '1', coin: 'penny' });
  });
});

describe('the settings a game refuses to start on', () => {
  it('accepts settings a schema offers, and an absent choice for every one', () => {
    expect(settingsRefusal(coinToss, undefined)).toBeNull();
    expect(settingsRefusal(coinToss, {})).toBeNull();
    expect(settingsRefusal(coinToss, { tosses: '3', coin: 'pound' })).toBeNull();
  });

  it('refuses a setting the game does not declare', () => {
    expect(settingsRefusal(coinToss, { weather: 'rain' })).toEqual({
      kind: 'settingRejected',
      key: 'weather',
      value: 'rain',
    });
  });

  it('refuses a value the setting does not offer', () => {
    expect(settingsRefusal(coinToss, { tosses: '7' })).toEqual({
      kind: 'settingRejected',
      key: 'tosses',
      value: '7',
    });
  });

  it('refuses anything at all for a game that declares no settings', () => {
    expect(settingsRefusal([], { tosses: '1' })).toEqual({
      kind: 'settingRejected',
      key: 'tosses',
      value: '1',
    });
  });
});
