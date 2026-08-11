import { settingsFrom, settingsRefusal } from '@huddle/game-core';
import { CURATED_PACK } from '@huddle/packs';
import { describe, expect, it } from 'vitest';

import { EVERY_CATEGORY } from './questions';
import {
  QUESTION_COUNTS,
  SCORING_MODES,
  triviaSettings,
  TRIVIA_SETTINGS_PRESENTATION,
  TRIVIA_SETTINGS_SCHEMA,
} from './settings';

/**
 * The settings trivia declares, and what it makes of the Host's answers.
 *
 * The schema is data the hub renders and validates without reading, so what is
 * asserted here is the declaration itself — the keys, the values on offer and
 * the defaults among them — plus the one thing trivia does with it: turning a
 * settled record of strings into the three things its rules need.
 */

function setting(key: string) {
  const declared = TRIVIA_SETTINGS_SCHEMA.find((option) => option.key === key);

  if (declared === undefined) {
    throw new Error(`trivia declares no "${key}" setting`);
  }

  return declared;
}

function valuesOf(key: string): readonly string[] {
  return setting(key).options.map((option) => option.value);
}

describe('the settings trivia declares', () => {
  it('offers a scoring mode, defaulting to flat', () => {
    expect(valuesOf('scoring')).toEqual([...SCORING_MODES]);
    expect(setting('scoring').defaultValue).toBe('flat');
  });

  it('offers 5, 10, 15, or 20 questions, defaulting to 10', () => {
    expect(valuesOf('questionCount')).toEqual(['5', '10', '15', '20']);
    expect(setting('questionCount').defaultValue).toBe('10');
  });

  it('offers the four difficulty levels and custom timing without scoring controls', () => {
    expect(valuesOf('difficulty')).toEqual(['easy', 'medium', 'hard', 'mixed']);
    expect(valuesOf('questionSeconds')).toEqual(['10', '15', '20', '30']);
    expect(TRIVIA_SETTINGS_PRESENTATION.customSettingKeys).not.toContain('scoring');
    expect(TRIVIA_SETTINGS_PRESENTATION.customOptions?.questionSeconds).toEqual(['10', '20', '30']);
  });

  it('offers every category the pack uses, plus all of them, defaulting to all', () => {
    // Derived from the pack rather than written down beside it: a pack that
    // gains a category gains a filter for it, and one that drops a category
    // stops offering a filter that would deal nothing.
    const packCategories = [...new Set(CURATED_PACK.questions.map((question) => question.category))];

    expect(valuesOf('category')).toEqual([EVERY_CATEGORY, ...packCategories]);
    expect(setting('category').defaultValue).toBe(EVERY_CATEGORY);
  });

  it('labels every option, because the hub draws them without reading them', () => {
    for (const declared of TRIVIA_SETTINGS_SCHEMA) {
      expect(declared.label).not.toBe('');

      for (const option of declared.options) {
        expect(option.label, `${declared.key}/${option.value}`).not.toBe('');
      }
    }
  });

  it('never offers a category the pack cannot answer', () => {
    // The structural guarantee the rules lean on: every option except "all" is
    // a category some question is in, so a filtered game is never dealt an
    // empty question list.
    for (const category of valuesOf('category')) {
      const asked = CURATED_PACK.questions.filter(
        (question) => category === EVERY_CATEGORY || question.category === category,
      );

      expect(asked.length, category).toBeGreaterThan(0);
    }
  });
});

describe('what trivia makes of the Host’s settings', () => {
  it('reads a Host who chose nothing as the schema’s own defaults', () => {
    expect(triviaSettings(undefined)).toEqual({
      scoring: 'flat',
      questionCount: 10,
      category: EVERY_CATEGORY,
    });
  });

  it('reads back exactly what the hub settled', () => {
    const chosen = settingsFrom(TRIVIA_SETTINGS_SCHEMA, {
      scoring: 'speed',
      questionCount: '5',
      category: 'Movies',
    });

    expect(triviaSettings(chosen)).toEqual({
      scoring: 'speed',
      questionCount: 5,
      category: 'Movies',
    });
  });

  it('reads modern setup settings and keeps Speed as a legacy decode path', () => {
    expect(
      triviaSettings({ questionCount: '15', difficulty: 'hard', questionSeconds: '30', category: 'Movies' }),
    ).toMatchObject({ questionCount: 15, difficulty: 'hard', questionSeconds: 30 });
  });

  it('falls back to a default rather than dealing a game it cannot run', () => {
    // Unreachable through `startGame`, which refuses these outright — but the
    // reader is total so that no state can be seeded from a value trivia has no
    // meaning for.
    expect(triviaSettings({ questionCount: 'lots', scoring: 'vibes' })).toEqual({
      scoring: 'flat',
      questionCount: 10,
      category: EVERY_CATEGORY,
    });
  });

  it('is every count the schema offers, as a number', () => {
    for (const count of QUESTION_COUNTS) {
      expect(triviaSettings({ questionCount: String(count) }).questionCount).toBe(count);
    }
  });

  it('declares nothing the hub would refuse to start on', () => {
    // The schema's own defaults have to be startable settings, or a Host who
    // opened the settings screen and changed nothing would be refused.
    expect(settingsRefusal(TRIVIA_SETTINGS_SCHEMA, settingsFrom(TRIVIA_SETTINGS_SCHEMA, undefined)))
      .toBeNull();
  });
});
