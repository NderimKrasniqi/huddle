import { describe, expect, it } from 'vitest';

import { triviaSettings, TRIVIA_SETTINGS_SCHEMA, TRIVIA_SETTINGS_PRESENTATION } from './settings';

describe('Trivia settings', () => {
  it('keeps the persisted questions key while exposing the full Heartbeat range', () => {
    const questions = TRIVIA_SETTINGS_SCHEMA.find((setting) => setting.key === 'questions');

    expect(questions?.options.map(({ value }) => value)).toEqual(['5', '10', '15', '20']);
    expect(triviaSettings({ questions: '5' }).questions).toBe(5);
    expect(triviaSettings({ questions: '20' }).questions).toBe(20);
    expect(triviaSettings(undefined).questions).toBe(10);
  });

  it('settles invalid and historical values to safe defaults', () => {
    expect(triviaSettings({ questionCount: '5' }).questions).toBe(10);
    expect(triviaSettings({ questions: 'not-a-count', category: 'not-a-category' })).toEqual({
      scoring: 'flat',
      questions: 10,
      difficulty: 'mixed',
      questionSeconds: 20,
      category: 'all',
    });
  });

  it('offers quick and standard presets with the documented twenty-second pace', () => {
    expect(TRIVIA_SETTINGS_PRESENTATION.presets).toEqual([
      expect.objectContaining({ mode: 'quick', settings: expect.objectContaining({ questions: '5', questionSeconds: '20' }) }),
      expect.objectContaining({ mode: 'standard', settings: expect.objectContaining({ questions: '10', questionSeconds: '20' }) }),
    ]);
  });

  it('exposes scoring, count, difficulty, timer, and category as custom settings', () => {
    expect(TRIVIA_SETTINGS_PRESENTATION.customSettingKeys).toEqual([
      'scoring',
      'questions',
      'difficulty',
      'questionSeconds',
      'category',
    ]);
  });
});
