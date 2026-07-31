import type { GameSettingsSchema } from '@huddle/game-core';
import { GAME_REGISTRY } from '@huddle/game-registry';
import { describe, expect, it } from 'vitest';

import {
  type SettingOptionControl,
  type SettingsChoice,
  settingChosen,
  settingsControls,
  settingsToStart,
} from './settings-choice';

/**
 * A schema no game in this repo declares, and the point of the whole task: the
 * Host's screen is tested against a made-up game, because a screen that could
 * only draw trivia's three settings would be a screen that had learnt what game
 * it is drawing.
 */
const MADE_UP_SCHEMA: GameSettingsSchema = [
  {
    key: 'tempo',
    label: 'Tempo',
    options: [
      { value: 'slow', label: 'Slow' },
      { value: 'brisk', label: 'Brisk' },
    ],
    defaultValue: 'brisk',
  },
  {
    key: 'rounds',
    label: 'Rounds',
    options: [
      { value: '3', label: 'Three' },
      { value: '7', label: 'Seven' },
    ],
    defaultValue: '3',
  },
];

const OTHER_SCHEMA: GameSettingsSchema = [
  {
    key: 'board',
    label: 'Board',
    options: [
      { value: 'small', label: 'Small' },
      { value: 'large', label: 'Large' },
    ],
    defaultValue: 'small',
  },
];

/** The options of `key`, as the controls offer them. */
function optionsOf(
  controls: ReturnType<typeof settingsControls>,
  key: string,
): readonly SettingOptionControl[] | undefined {
  return controls.find((control) => control.key === key)?.options;
}

/** The value of `key` the controls are showing as chosen. */
function litValue(
  controls: ReturnType<typeof settingsControls>,
  key: string,
): string | undefined {
  return controls
    .find((control) => control.key === key)
    ?.options.find((option) => option.chosen)?.value;
}

describe('the controls the Host is drawn', () => {
  it('are whatever the chosen game declares, in its own order', () => {
    const controls = settingsControls(MADE_UP_SCHEMA, 'made-up', undefined);

    expect(controls.map((control) => control.key)).toEqual(['tempo', 'rounds']);
    expect(controls.map((control) => control.label)).toEqual(['Tempo', 'Rounds']);
    expect(optionsOf(controls, 'tempo')).toEqual([
      { value: 'slow', label: 'Slow', chosen: false },
      { value: 'brisk', label: 'Brisk', chosen: true },
    ]);
  });

  it('draw the installed game’s settings without being told which game it is', () => {
    // The Registry is the only thing in the hub that names a game; this reads
    // the schema off the module the carousel is focused on, exactly as the
    // screen does.
    const installed = GAME_REGISTRY[0];

    expect(installed).toBeDefined();

    const controls = settingsControls(
      installed?.settingsSchema ?? [],
      installed?.metadata.id ?? '',
      undefined,
    );

    expect(controls.map((control) => control.key)).toEqual(
      installed?.settingsSchema.map((setting) => setting.key),
    );
  });

  it('light the schema’s own default until the Host touches anything', () => {
    const controls = settingsControls(MADE_UP_SCHEMA, 'made-up', undefined);

    expect(litValue(controls, 'tempo')).toBe('brisk');
    expect(litValue(controls, 'rounds')).toBe('3');
  });

  it('light what the Host chose, and only in the setting they chose it in', () => {
    const choice = settingChosen('made-up', undefined, 'tempo', 'slow');
    const controls = settingsControls(MADE_UP_SCHEMA, 'made-up', choice);

    expect(litValue(controls, 'tempo')).toBe('slow');
    expect(litValue(controls, 'rounds')).toBe('3');
  });

  it('draw nothing for a game that declares no settings', () => {
    expect(settingsControls([], 'settingless', undefined)).toEqual([]);
  });
});

describe('what the room would start on', () => {
  it('is the schema’s defaults for a Host who chose nothing', () => {
    expect(settingsToStart(MADE_UP_SCHEMA, 'made-up', undefined)).toEqual({
      tempo: 'brisk',
      rounds: '3',
    });
  });

  it('changes the moment the Host changes a control', () => {
    const choice = settingChosen('made-up', undefined, 'rounds', '7');

    expect(settingsToStart(MADE_UP_SCHEMA, 'made-up', choice)).toEqual({
      tempo: 'brisk',
      rounds: '7',
    });
  });

  it('keeps the settings the Host chose earlier', () => {
    const first = settingChosen('made-up', undefined, 'rounds', '7');
    const second = settingChosen('made-up', first, 'tempo', 'slow');

    expect(settingsToStart(MADE_UP_SCHEMA, 'made-up', second)).toEqual({
      tempo: 'slow',
      rounds: '7',
    });
  });

  it('takes the Host’s last word on a setting they changed twice', () => {
    const first = settingChosen('made-up', undefined, 'tempo', 'slow');
    const second = settingChosen('made-up', first, 'tempo', 'brisk');

    expect(settingsToStart(MADE_UP_SCHEMA, 'made-up', second).tempo).toBe('brisk');
  });

  it('is always complete, whatever the Host touched', () => {
    const choice = settingChosen('made-up', undefined, 'tempo', 'slow');

    // Every key the schema declares, so the room is never handed a game short a
    // setting — the same guarantee `settingsFrom` gives the server.
    expect(Object.keys(settingsToStart(MADE_UP_SCHEMA, 'made-up', choice)).sort()).toEqual(
      MADE_UP_SCHEMA.map((setting) => setting.key).sort(),
    );
  });
});

describe('the Host browsing to another card', () => {
  it('leaves the settings they chose on the card they chose them on', () => {
    // The carousel keeps working while the Host is choosing, and this is what
    // that costs: a setting from another game's schema would be refused by
    // `startGame` as a `settingRejected`, so it never travels.
    const choice = settingChosen('made-up', undefined, 'tempo', 'slow');

    expect(settingsToStart(OTHER_SCHEMA, 'other', choice)).toEqual({ board: 'small' });
    expect(litValue(settingsControls(OTHER_SCHEMA, 'other', choice), 'board')).toBe('small');
  });

  it('starts that card’s settings from its own defaults', () => {
    const choice: SettingsChoice = settingChosen('other', undefined, 'board', 'large');
    const back = settingChosen('made-up', choice, 'rounds', '7');

    expect(settingsToStart(MADE_UP_SCHEMA, 'made-up', back)).toEqual({
      tempo: 'brisk',
      rounds: '7',
    });
    // And the card left behind is back to its own default, not the Host's
    // earlier pick: one choice at a time, for the card in front of them.
    expect(settingsToStart(OTHER_SCHEMA, 'other', back)).toEqual({ board: 'small' });
  });
});
