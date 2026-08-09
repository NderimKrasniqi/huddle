import { describe, expect, it } from 'vitest';

import type { RosterSeat } from './host';
import { rosterRowControls, rosterRowIsManageable } from './host-controls';

/** A roster the way the room serves one, as `host-roster.test.ts` builds them. */
function seatOf({
  name,
  host = false,
  away = false,
}: {
  name: string;
  host?: boolean;
  away?: boolean;
}): RosterSeat {
  return {
    playerId: `player-${name}` as RosterSeat['playerId'],
    nickname: name,
    away,
    host,
    avatar: 'fox' as const,
  };
}

describe('rosterRowControls', () => {
  it('offers a present player both powers, both live', () => {
    const controls = rosterRowControls(seatOf({ name: 'Grace' }));

    expect(controls.map((control) => control.action)).toEqual(['transfer', 'remove']);
    expect(controls.every((control) => control.enabled)).toBe(true);
    expect(controls.every((control) => control.disabledBecause === undefined)).toBe(true);
  });

  it('offers the Host nothing against their own row', () => {
    // No room to hand oneself and no self to remove — the server refuses both as
    // `targetIsSelf`, so the row draws no control to earn it.
    expect(rosterRowControls(seatOf({ name: 'Ada', host: true }))).toEqual([]);
  });

  it('dims transfer for an away target and says why', () => {
    // Handing the room needs a successor the room is still hearing from
    // (`transferHost`'s `targetAway`), so the control is dimmed before the tap.
    const transfer = rosterRowControls(seatOf({ name: 'Milo', away: true })).find(
      (control) => control.action === 'transfer',
    );

    expect(transfer?.enabled).toBe(false);
    expect(transfer?.disabledBecause).toContain('away');
  });

  it('keeps remove live for an away target', () => {
    // Clearing out a phone that has gone quiet is the main thing a Host removes
    // anyone for, so removal has no presence bar.
    const remove = rosterRowControls(seatOf({ name: 'Milo', away: true })).find(
      (control) => control.action === 'remove',
    );

    expect(remove?.enabled).toBe(true);
    expect(remove?.disabledBecause).toBeUndefined();
  });
});

describe('rosterRowIsManageable', () => {
  it('lets the Host manage another player', () => {
    expect(rosterRowIsManageable(seatOf({ name: 'Grace' }))).toBe(true);
  });

  it('does not let the Host manage their own row', () => {
    expect(rosterRowIsManageable(seatOf({ name: 'Ada', host: true }))).toBe(false);
  });

  it('lets the Host manage an away player — removal is still on offer', () => {
    expect(rosterRowIsManageable(seatOf({ name: 'Milo', away: true }))).toBe(true);
  });
});
