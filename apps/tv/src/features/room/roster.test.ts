import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import { describe, expect, it } from 'vitest';

import {
  roomCountLine,
  roomGridHeight,
  roomGridWidth,
  roomLayout,
  roomScreenHeight,
  roomSeats,
  type RosterSeat,
  seat,
  SEAT_HEIGHT,
  seatSlot,
  seatSpokenAs,
  SEATS_PER_ROW,
} from './roster';

/**
 * `tvDesignSize` from @huddle/ui, written out: that package's entry point also
 * exports the font assets, which a Node test runner cannot load.
 */
const STAGE = { width: 1280, height: 720 } as const;

/** The handoff's TV safe margin, which nothing on the grid may cross. */
const SAFE_MARGIN = 64;

/** A seated player, as `players.roster` serves one. */
const seatOf = (
  nickname: string,
  extra: Partial<RosterSeat> = {},
): RosterSeat => ({
  playerId: `player-${nickname}` as RosterSeat['playerId'],
  nickname,
  away: false,
  host: false,
  avatar: 'fox',
  ...extra,
});

const ada = seatOf('Ada', { host: true });
const grace = seatOf('Grace');
const alan = seatOf('Alan', { away: true });

describe('roomSeats', () => {
  it('draws a place for every seat in the room, however empty', () => {
    expect(roomSeats([])).toHaveLength(ROOM_PLAYER_CAP);
    expect(roomSeats([ada, grace])).toHaveLength(ROOM_PLAYER_CAP);
  });

  it('seats the party in join order, then the places still going spare', () => {
    const places = roomSeats([ada, grace]);

    expect(places[0]).toEqual({ kind: 'taken', seat: ada });
    expect(places[1]).toEqual({ kind: 'taken', seat: grace });
    expect(places[2]).toEqual({ kind: 'empty', number: 3 });
  });

  it('numbers an empty place by where it sits in the room', () => {
    const empties = roomSeats([ada])
      .filter((place) => place.kind === 'empty')
      .map((place) => place.number);

    expect(empties).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('leaves no dashed circle in a full room', () => {
    const full = Array.from({ length: ROOM_PLAYER_CAP }, (_unused, at) => seatOf(`P${at}`));

    expect(roomSeats(full).every((place) => place.kind === 'taken')).toBe(true);
  });

  it('draws an over-full roster whole rather than dropping a player', () => {
    // The cap is enforced inside a serializable transaction, so this cannot
    // happen — but a television that silently lost somebody would be a worse
    // bug than one that ran a third row off the bottom of the stage.
    const eleven = Array.from({ length: ROOM_PLAYER_CAP + 1 }, (_unused, at) => seatOf(`P${at}`));

    expect(roomSeats(eleven)).toHaveLength(ROOM_PLAYER_CAP + 1);
  });
});

describe('the grid', () => {
  it('uses the approved five-column Room geometry', () => {
    expect(seat.avatar).toBe(70);
    expect(roomGridWidth()).toBe(5 * 118 + 4 * 6);
    expect(seat.width + seat.columnGap).toBe(124);
  });

  it('fits the stage inside the handoff’s TV safe margin', () => {
    // No television is attached to this machine, so the fit is checked as
    // arithmetic rather than seen.
    expect(roomGridWidth()).toBeLessThanOrEqual(STAGE.width - 2 * SAFE_MARGIN);
  });

  it('lays the room out over two rows', () => {
    expect(SEATS_PER_ROW * 2).toBe(ROOM_PLAYER_CAP);
    expect(roomGridHeight()).toBe(2 * SEAT_HEIGHT + seat.rowGap);
    expect(SEAT_HEIGHT + seat.rowGap).toBe(145);
  });

  it('leaves the rest of the screen room for the code, the QR and the count', () => {
    // The hero above the grid is the reason this screen exists; a grid that ate
    // it would be a Room nobody could join.
    expect(roomGridHeight()).toBeLessThan(STAGE.height / 2);
  });
});

describe('roomScreenHeight', () => {
  it('keeps the approved Room landmarks', () => {
    // Measured off `docs/design/reference/screens/01-room.png` in design units —
    // board pixels ÷ 1.30625, since the board is a 1672-wide render of this
    // 1280-wide composition. The tile was 105 × 89 here until 2026-08-09, from
    // the board export that #27 replaced; the current export's tile is square.
    expect(roomLayout).toMatchObject({
      headerTop: 32,
      wordmark: 61,
      titleTop: 78,
      titleLine: 58,
      tileWidth: 99,
      tileHeight: 99,
      captionLine: 22,
      dividerGap: 21,
    });
  });

  it('draws the code tile square, as the board does', () => {
    // The regression this guards is a *comparison* error, not a typo: measuring
    // board pixels against screenshot pixels makes everything look ~10% small,
    // because `tvSafeStageScale` insets the stage to 90% and the board has no
    // such inset. A tile that is merely the wrong shape survives that noise,
    // which is how 105 × 89 lasted. Aspect is the assertion that does not.
    expect(roomLayout.tileWidth).toBe(roomLayout.tileHeight);
  });

  it('fits the stage at a full room', () => {
    // The bound is the stage itself, not the handoff's 64pt TV safe margin.
    // `TvStage` scales the whole 1280×720 composition into the title-safe inner
    // 90% (`tvSafeStageScale`), so every point of the design surface is already
    // clear of the bezel and a second inset inside it would be belt *and*
    // braces — which here cost real fidelity: the board's own element sizes do
    // not fit a 16:9 stage inside a further 64pt, and the board is the design.
    //
    // What still has to hold is that the column fits the surface at all, since
    // nothing about this screen scrolls or flexes.
    expect(roomScreenHeight()).toBeLessThanOrEqual(STAGE.height);
  });

  it('leaves the bottom of the stage clear rather than filling it exactly', () => {
    // The board's own layout runs to 725 on a 768-tall frame; ours has 720, so
    // the five points come out of `gridGap` and this holds the rest of the
    // margin that difference leaves.
    //
    // The bound was 689 until 2026-08-09, when the title grew from 40px to 48px
    // and took `titleLine` from 48 to 58 with it. Those ten points come off this
    // margin rather than out of the grid or the hero, which is a deliberate trade
    // — 23pt of the stage still stands clear below the count, and the assertion
    // that actually protects the screen is the one above, against the stage.
    expect(roomScreenHeight()).toBeLessThanOrEqual(700);
  });

  it('spends every term in `roomLayout` except the wordmark’s, and the grid', () => {
    // The stack is the whole of `roomLayout` plus the grid, less the two terms
    // that place the wordmark: it sits in the left gutter *behind* the title's
    // band rather than above it, so it adds no height and `titleTop` already
    // clears it. Everything else is a term. A number added to `roomLayout` and
    // not wired into the sum fails here, which is what stops this being a total
    // somebody has to remember to update by hand.
    const { headerTop, wordmark, tileWidth, tileHeight, ...inFlow } = roomLayout;
    const stacked = Object.values(inFlow).reduce((total, term) => total + term, 0);

    expect(roomScreenHeight()).toBe(stacked + tileHeight + roomGridHeight());
    expect(headerTop + wordmark).toBeLessThanOrEqual(roomLayout.titleTop + roomLayout.titleLine);
  });
});

describe('seatSlot', () => {
  it('gives an arrival their four seconds ahead of anything else', () => {
    // Including the Host's own: the room's first player is both at once, and
    // for those four seconds the news is that somebody is here at all. The
    // Host flag remains independent, so the avatar crown stays visible.
    expect(seatSlot(ada, true)).toBe('justJoined');
    expect(ada.host).toBe(true);
    expect(seatSlot(alan, true)).toBe('justJoined');
  });

  it('says who the Host is, over their own away-ness', () => {
    expect(seatSlot(ada, false)).toBe('host');
    expect(seatSlot(seatOf('Ada', { host: true, away: true }), false)).toBe('host');
  });

  it('says a player has gone quiet', () => {
    expect(seatSlot(alan, false)).toBe('away');
  });

  it('says nothing but present for everybody else', () => {
    expect(seatSlot(grace, false)).toBe('present');
  });
});

describe('seatSpokenAs', () => {
  it('says what a slot shows in a hue alone', () => {
    expect(seatSpokenAs(ada, false)).toBe('Ada, host');
    expect(seatSpokenAs(grace, false)).toBe('Grace, online');
    expect(seatSpokenAs(alan, false)).toBe('Alan, away');
    expect(seatSpokenAs(grace, true)).toBe('Grace, just joined');
  });
});

describe('roomCountLine', () => {
  it('waits for players while the room is empty', () => {
    expect(roomCountLine(0, undefined)).toEqual({
      joined: 0,
      total: ROOM_PLAYER_CAP,
      note: 'waiting for players…',
    });
  });

  it('tells the room who can start it', () => {
    expect(roomCountLine(6, 'Sam')).toEqual({
      joined: 6,
      total: ROOM_PLAYER_CAP,
      note: 'Sam can start whenever',
    });
  });

  it('counts a full room', () => {
    expect(roomCountLine(ROOM_PLAYER_CAP, 'Sam')).toEqual({
      joined: ROOM_PLAYER_CAP,
      total: ROOM_PLAYER_CAP,
      note: 'Sam can start whenever',
    });
  });

  it('says only the count when there is no Host to name', () => {
    // The backend does not serve a peopled room without a Host; a screen that
    // invented one would be saying something it had not been told.
    expect(roomCountLine(2, undefined).note).toBeUndefined();
  });

  it('waits for players even if a Host is somehow named in an empty room', () => {
    expect(roomCountLine(0, 'Sam').note).toBe('waiting for players…');
  });
});
