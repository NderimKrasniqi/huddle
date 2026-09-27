import { AVATAR_IDS, GAME_SETTING_ICONS } from '@huddle/contracts';
import { describe, expect, it } from 'vitest';

import { PLAYROOM_AVATARS, PLAYROOM_SETTING_ICONS, playroomGameArt } from './playroom-artwork';

describe('Playroom artwork', () => {
  it('has a portrait for every stable avatar id', () => {
    expect(Object.keys(PLAYROOM_AVATARS).sort()).toEqual([...AVATAR_IDS].sort());
  });

  it('has a picture for every setting icon a game can declare', () => {
    expect(Object.keys(PLAYROOM_SETTING_ICONS).sort()).toEqual([...GAME_SETTING_ICONS].sort());
  });

  it('has catalog art for the five registry cards and none for unknown games', () => {
    for (const id of ['trivia', 'voting', 'doodle-dash', 'quick-poll', 'hot-take']) {
      expect(playroomGameArt(id)).toBeDefined();
    }
    expect(playroomGameArt('not-installed')).toBeUndefined();
  });
});
