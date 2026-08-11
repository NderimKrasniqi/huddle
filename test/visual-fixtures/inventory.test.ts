import { describe, expect, it } from 'vitest';

import {
  PHONE_FIXTURE_VIEWPORT,
  PHONE_REFERENCE_FIXTURES,
  TV_FIXTURE_VIEWPORT,
  TV_REFERENCE_FIXTURES,
} from './manifest';

describe('approved visual fixture inventory', () => {
  it('covers each phone state at the canonical interior viewport', () => {
    expect(PHONE_FIXTURE_VIEWPORT).toEqual({ width: 393, height: 852 });
    expect(PHONE_REFERENCE_FIXTURES.map((fixture) => fixture.id)).toEqual([
      'join',
      'host-room',
      'manage-player',
      'game-picker',
      'player-waiting',
      'settings-standard',
      'settings-quick',
      'settings-custom',
      'finished-player',
      'finished-host',
    ]);

    for (const fixture of PHONE_REFERENCE_FIXTURES) {
      const [width, height] = fixture.referenceSize;
      expect(fixture.reference.endsWith('.png'), fixture.id).toBe(true);
      expect(width, fixture.id).toBeGreaterThan(0);
      expect(height, fixture.id).toBeGreaterThan(0);
    }
  });

  it('keeps TV Game Setup on the supplied 1672×941 canvas', () => {
    expect(TV_FIXTURE_VIEWPORT).toEqual({ width: 1672, height: 941 });
    expect(TV_REFERENCE_FIXTURES).toEqual([
      {
        id: 'game-setup',
        reference: 'docs/design/reference/screens/03-game-setup.png',
        referenceSize: [1672, 941],
      },
    ]);
    expect(TV_REFERENCE_FIXTURES[0].referenceSize).toEqual([1672, 941]);
  });
});
