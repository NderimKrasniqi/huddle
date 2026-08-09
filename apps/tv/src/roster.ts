import type { api } from '@huddle/convex';
import { ROOM_PLAYER_CAP } from '@huddle/game-core';
import type { FunctionReturnType } from 'convex/server';

/**
 * The Room screen's player grid: how the seats are laid out, what each one's
 * status slot says, and how the line under them counts the room
 * (`docs/design/reference/screens/01-room.png`).
 *
 * It sits beside the screen rather than inside it because it is the part of the
 * roster that can be checked without a television — the grid has to fit the
 * stage at a full room, the slot has an order of precedence, and the count has
 * to read correctly at nought, one and ten players.
 *
 * What a seat has to say came *back* here. Soft Minimal's television left the
 * pairing screen at the first join, so a seat with a player in it was never
 * drawn and every treatment that needed one had been deleted; Soft Minimal's
 * Room keeps the code, the QR and the roster on one screen for as long as the
 * room is between games, so the seats are the surface the room's news belongs
 * on again.
 */

/**
 * One taken seat, taken from the query that serves it — the TV draws what the
 * backend says a seat is, and never its own idea of one.
 */
export type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];

/**
 * Seat measurements at the TV's 1280×720 design size.
 *
 * `ROOM_PLAYER_CAP` is ten, so the Room uses a stable 5×2 grid. The column is
 * wider than the avatar to leave room for a nickname and status slot.
 */
export const seat = {
  /** The avatar circle's diameter on the approved Room board. */
  avatar: 70,
  /**
   * The column a seat occupies. Five columns at 118pt with a 6pt gap make the
   * approved 124pt centre-to-centre pitch while leaving room for a nickname.
   */
  width: 118,
  /**
   * Space between columns. Together with the 118pt column this is the board's
   * 124pt centre-to-centre pitch.
   */
  columnGap: 6,
  /** Space between the two rows; the board's row pitch is 145. */
  rowGap: 4,
  /** Space between the circle and the nickname. */
  nameGap: 13,
  /** The nickname's line. */
  nameLine: 22,
  /** Space between the nickname and the status slot. */
  statusGap: 16,
  /** The status slot's line — a HOST label, a dot, an AWAY or JUST JOINED chip. */
  statusLine: 20,
} as const;

/** How many seats stand side by side; `ROOM_PLAYER_CAP` over two rows. */
export const SEATS_PER_ROW = 5;

/** The QR bitmap's 87pt edge on the approved Room board. */
export const ROOM_QR_SIZE = 87;

/** The height of one seat: circle, nickname and status slot with their gaps. */
export const SEAT_HEIGHT =
  seat.avatar + seat.nameGap + seat.nameLine + seat.statusGap + seat.statusLine;

/** How wide a row of `SEATS_PER_ROW` seats lies at the TV's design size. */
export function roomGridWidth(): number {
  return SEATS_PER_ROW * seat.width + (SEATS_PER_ROW - 1) * seat.columnGap;
}

/** How tall the grid stands, at the two rows `ROOM_PLAYER_CAP` needs. */
export function roomGridHeight(): number {
  const rows = Math.ceil(ROOM_PLAYER_CAP / SEATS_PER_ROW);

  return rows * SEAT_HEIGHT + (rows - 1) * seat.rowGap;
}

/**
 * The approved Soft Minimal board's 1280×720 vertical landmarks live here so
 * `roomScreenHeight()` can be checked arithmetically rather than by eye.
 */
export const roomLayout = {
  /** The wordmark's top band. */
  headerTop: 32,
  wordmark: 47,
  /** Top of the title line, clear of the wordmark. */
  titleTop: 78,
  titleLine: 48,
  /** Down to the code tiles and the QR beside them. */
  heroGap: 21,
  /** The approved board's code tile is wider than it is tall. */
  tileWidth: 105,
  tileHeight: 89,
  tileCaptionGap: 24,
  captionLine: 22,
  /** Down to the `PLAYERS IN THE ROOM` rule. */
  dividerGap: 21,
  dividerLine: 20,
  /** Down to the grid. */
  gridGap: 26,
  /** Down to the count. */
  countGap: 12,
  countLine: 30,
} as const;

/**
 * The hero's height: the code tiles over their caption.
 *
 * The QR sits beside this column and remains shorter (87pt) than the tile's
 * 89pt height, so this code column determines the hero row's height.
 */
export function roomHeroHeight(): number {
  return roomLayout.tileHeight + roomLayout.tileCaptionGap + roomLayout.captionLine;
}

/**
 * How tall the whole Room screen stands, at the two rows a full room needs.
 *
 * Measured from the top of the stage to the bottom of the count line. The
 * wordmark is not a term: it sits in the left gutter *behind* the title's band
 * rather than above it, so it adds no height (`titleTop` already clears it).
 */
export function roomScreenHeight(): number {
  const { titleTop, titleLine, heroGap } = roomLayout;
  const { dividerGap, dividerLine, gridGap, countGap, countLine } = roomLayout;

  return (
    titleTop +
    titleLine +
    heroGap +
    roomHeroHeight() +
    dividerGap +
    dividerLine +
    gridGap +
    roomGridHeight() +
    countGap +
    countLine
  );
}

/** A place in the grid: somebody's, or nobody's yet. */
export type RoomSeat =
  | { readonly kind: 'taken'; readonly seat: RosterSeat }
  | {
      readonly kind: 'empty';
      /** Its place in the room, 1-based — what the dashed circle prints. */
      readonly number: number;
    };

/**
 * Every place in the room, taken ones first.
 *
 * The grid is always `ROOM_PLAYER_CAP` places rather than growing with the
 * party: the dashed circles are the invitation, and a room that drew only the
 * seats it had filled would stop inviting anybody in exactly when it still had
 * room for them. They are numbered because the board numbers them — an empty
 * circle says "there is room", and `7` says how much.
 *
 * A roster longer than the cap is drawn in full rather than truncated. It
 * cannot happen — `joinRoom` enforces the cap inside a serializable transaction
 * — but a television that silently dropped a player would be a worse bug than
 * one that ran off the bottom of the stage, which is what an eleventh seat
 * would do: the grid's width is pinned to `SEATS_PER_ROW`, so the overflow is a
 * third row, not a wider one.
 */
export function roomSeats(roster: readonly RosterSeat[]): readonly RoomSeat[] {
  const taken = roster.map((seated): RoomSeat => ({ kind: 'taken', seat: seated }));
  const empty = Array.from(
    { length: Math.max(ROOM_PLAYER_CAP - roster.length, 0) },
    (_unused, position): RoomSeat => ({ kind: 'empty', number: roster.length + position + 1 }),
  );

  return [...taken, ...empty];
}

/**
 * What a seat's status slot says (the board: a crown and `HOST`, a green dot, a
 * blue `AWAY` chip — and the handoff's four seconds of `JUST JOINED!`).
 */
export type SeatSlot = 'justJoined' | 'host' | 'away' | 'present';

/**
 * What this seat has to say, in the order the room needs to hear it.
 *
 * An arrival's four seconds come first, including the Host's own: the room's
 * first player is both at once, and for those four seconds the news is that
 * somebody is here at all. That is the precedence Soft Minimal's carousel footer
 * line gave an arrival over the browsing sentence, kept as the surface moved.
 *
 * After that the order is the Host roster's (`apps/controller/src/host-roster.ts`)
 * rather than a second opinion about the same question: the Host's slot wins
 * over their own away-ness, so away-ness is never what a slot gives up on a row
 * that could meaningfully be away.
 */
export function seatSlot(seated: RosterSeat, greeting: boolean): SeatSlot {
  if (greeting) {
    return 'justJoined';
  }

  if (seated.host) {
    return 'host';
  }

  return seated.away ? 'away' : 'present';
}

/** What each slot reads as aloud, for anything that cannot see the grid. */
const SPOKEN_SLOT: Readonly<Record<SeatSlot, string>> = {
  justJoined: 'just joined',
  host: 'host',
  present: 'online',
  away: 'away',
};

/**
 * The seat as a screen reader takes it: the nickname, and what its slot says.
 *
 * The three that are not the Host's label differ in colour and in very little
 * else — a green dot against a grey one, a blue chip — and a television that
 * says who is away in a hue alone says it to some of the room.
 */
export function seatSpokenAs(seated: RosterSeat, greeting: boolean): string {
  return `${seated.nickname}, ${SPOKEN_SLOT[seatSlot(seated, greeting)]}`;
}

/**
 * The line under the grid: how full the room is, and what that means.
 *
 * Returned in parts rather than as a sentence because the board sets the count
 * itself in the accent and the rest in muted text, and a screen that had to
 * find the number inside a finished string would be parsing its own copy.
 */
export type RoomCountLine = {
  readonly joined: number;
  readonly total: number;
  /** What follows the count, if the room has anything to add. */
  readonly note: string | undefined;
};

/**
 * How the room is getting on, per the board's "6 of 12 joined — Sam can start
 * whenever" (at the twelve the board draws and the ten the room actually caps
 * at).
 *
 * The note is dropped rather than made up when there is nothing true to say. An
 * empty room is waiting for players; a room with a Host in it can be started by
 * them whenever they like; a room whose first roster has landed without a Host
 * — which the backend does not produce, but which a screen must survive — says
 * only the count.
 */
export function roomCountLine(
  joined: number,
  hostNickname: string | undefined,
): RoomCountLine {
  const note =
    joined === 0
      ? 'waiting for players…'
      : hostNickname === undefined
        ? undefined
        : `${hostNickname} can start whenever`;

  return { joined, total: ROOM_PLAYER_CAP, note };
}
