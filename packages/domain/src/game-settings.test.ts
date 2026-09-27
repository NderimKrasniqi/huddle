import { describe, expect, it } from 'vitest';

import type { GameSettingsPresentation, GameSettingsSchema } from '@huddle/contracts';
import {
  settingsFrom,
  settingsRefusal,
  settingsRefusalForMode,
  settingSummary,
  settingSummaryText,
} from './game-settings';

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

const coinTossPresentation: GameSettingsPresentation = {
  presets: [
    {
      mode: 'quick',
      label: 'Quick',
      settings: { tosses: '1', coin: 'penny' },
    },
    {
      mode: 'standard',
      label: 'Standard',
      settings: { tosses: '3', coin: 'pound' },
    },
  ],
  customSettingKeys: ['tosses'],
  customOptions: { tosses: ['1'] },
};

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

describe('the settings a setup mode refuses', () => {
  it('keeps generic schema validation when no presentation is declared', () => {
    expect(settingsRefusalForMode(coinToss, undefined, { tosses: '3' }, 'custom')).toBeNull();
    expect(settingsRefusalForMode(coinToss, undefined, { tosses: '7' }, 'custom')).toEqual({
      kind: 'settingRejected',
      key: 'tosses',
      value: '7',
    });
  });

  it('requires custom mode to leave hidden settings at their defaults', () => {
    expect(
      settingsRefusalForMode(
        coinToss,
        coinTossPresentation,
        { tosses: '1', coin: 'pound' },
        'custom',
      ),
    ).toEqual({ kind: 'settingRejected', key: 'coin', value: 'pound' });
  });

  it('enforces custom option allowlists', () => {
    expect(
      settingsRefusalForMode(coinToss, coinTossPresentation, { tosses: '3', coin: 'penny' }, 'custom'),
    ).toEqual({ kind: 'settingRejected', key: 'tosses', value: '3' });
  });

  it('requires quick and standard modes to match their module-owned presets', () => {
    expect(settingsRefusalForMode(coinToss, coinTossPresentation, { tosses: '3', coin: 'penny' }, 'quick')).toEqual({
      kind: 'settingRejected',
      key: 'tosses',
      value: '3',
    });
    expect(settingsRefusalForMode(coinToss, coinTossPresentation, { tosses: '3', coin: 'pound' }, 'standard')).toBeNull();
  });
});

describe('a setting as a summary reads it', () => {
  const timer = {
    key: 'timer',
    label: 'Timer',
    unit: 'seconds',
    defaultValue: '20',
    options: [
      { value: '20', label: '20 sec', short: '20' },
      { value: 'none', label: 'No timer', short: 'No', unit: 'timer' },
      { value: 'plain', label: 'Plain' },
    ],
  };

  it('pairs the short value with the setting’s unit', () => {
    expect(settingSummary(timer, '20')).toEqual({ value: '20', unit: 'seconds' });
    expect(settingSummaryText(timer, undefined)).toBe('20 seconds');
  });

  it('lets an option name its own unit', () => {
    expect(settingSummaryText(timer, 'none')).toBe('No timer');
  });

  it('falls back to the label, and to the raw value for anything undeclared', () => {
    expect(settingSummary(timer, 'plain')).toEqual({ value: 'Plain', unit: 'seconds' });
    expect(settingSummary(timer, 'gone')).toEqual({ value: 'gone' });
  });
});
