import { describe, expect, it } from 'vitest';

import { pickerControlState, pickerVisibility, setupModeLabel, setupReadiness } from './seated-phone-model';

const roster = [
  { playerId: 'host', away: false },
  { playerId: 'guest', away: false },
];

describe('Phone setup readiness', () => {
  it('keeps Start disabled until the Host is Ready too', () => {
    const guestReady = setupReadiness({
      stage: 'ready',
      playerRange: { min: 2, max: 10 },
      roster,
      readyPlayerIds: ['guest'],
      playerId: 'host',
    });

    expect(guestReady).toMatchObject({ allPresent: true, allReady: false, canStart: false, readyCount: 1, currentReady: false });

    const everyoneReady = setupReadiness({
      stage: 'ready',
      playerRange: { min: 2, max: 10 },
      roster,
      readyPlayerIds: ['host', 'guest'],
      playerId: 'host',
    });

    expect(everyoneReady).toMatchObject({ allPresent: true, allReady: true, canStart: true, readyCount: 2, currentReady: true });
  });

  it('blocks a start while a seated player is away or the draft is editing', () => {
    expect(setupReadiness({
      stage: 'ready',
      playerRange: { min: 2, max: 10 },
      roster: [...roster.slice(0, 1), { playerId: 'guest', away: true }],
      readyPlayerIds: ['host', 'guest'],
      playerId: 'host',
    }).canStart).toBe(false);

    expect(setupReadiness({
      stage: 'configuring',
      playerRange: { min: 2, max: 10 },
      roster,
      readyPlayerIds: [],
      playerId: 'host',
    }).canStart).toBe(false);
  });
});

describe('Phone picker capabilities', () => {
  it('keeps both Host and guest on a shared picker after browsing starts', () => {
    expect(pickerVisibility({ youAreHost: true, pickerOpen: false, browsingAt: 2, hasSetup: false })).toBe(true);
    expect(pickerVisibility({ youAreHost: false, pickerOpen: false, browsingAt: 2, hasSetup: false })).toBe(true);
  });

  it('allows only the Host’s local first-entry optimism before a shared index exists', () => {
    expect(pickerVisibility({ youAreHost: true, pickerOpen: true, browsingAt: null, hasSetup: false })).toBe(true);
    expect(pickerVisibility({ youAreHost: false, pickerOpen: true, browsingAt: null, hasSetup: false })).toBe(false);
    expect(pickerVisibility({ youAreHost: true, pickerOpen: false, browsingAt: null, hasSetup: true })).toBe(true);
  });

  it('keeps browse and select as separate Host actions', () => {
    expect(pickerControlState({ youAreHost: true, focusedPlaceholder: false, busy: false })).toEqual({
      cardAction: 'browse',
      selectEnabled: true,
      guestWaiting: false,
    });
  });

  it('disables selection for Coming soon cards and while a mutation is busy', () => {
    expect(pickerControlState({ youAreHost: true, focusedPlaceholder: true, busy: false }).selectEnabled).toBe(false);
    expect(pickerControlState({ youAreHost: true, focusedPlaceholder: false, busy: true })).toMatchObject({ cardAction: null, selectEnabled: false });
  });

  it('gives guests a passive waiting surface with no Back control', () => {
    expect(pickerControlState({ youAreHost: false, focusedPlaceholder: false, busy: false })).toEqual({
      cardAction: null,
      selectEnabled: false,
      guestWaiting: true,
    });
  });

  it('capitalizes the three setup modes for native labels', () => {
    expect((['quick', 'standard', 'custom'] as const).map(setupModeLabel)).toEqual(['Quick', 'Standard', 'Custom']);
  });
});
