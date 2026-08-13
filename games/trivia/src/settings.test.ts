import { describe, expect, it } from 'vitest';
import { triviaSettings, TRIVIA_SETTINGS_SCHEMA } from './settings';

describe('Trivia proof settings', () => {
  it('offers only five or ten questions', () => {
    expect(TRIVIA_SETTINGS_SCHEMA[0]?.options.map(({ value }) => value)).toEqual(['5', '10']);
    expect(triviaSettings({ questions: '5' })).toEqual({ questions: 5 });
    expect(triviaSettings(undefined)).toEqual({ questions: 10 });
  });
});
