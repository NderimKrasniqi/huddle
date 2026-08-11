import {
  NICKNAME_MAX_LENGTH,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from '@huddle/game-core';

/**
 * What the join screen's two fields make of what is typed into them.
 *
 * Both fields are controlled, so every keystroke passes through here: the
 * keyboard hands over the whole text it produced and gets back the value the
 * screen shows. Auto-advance and backspace are then properties of that value
 * rather than of the widget — the caret sits in the first cell without a
 * letter — which is why this is the part of the join screen that can be checked
 * without a phone.
 */

/**
 * The Room Code as the tiles show it: the letters of the alphabet in what was
 * typed, upper-cased, and no more of them than a code holds.
 *
 * Filtering rather than rejecting is deliberate. The code arrives by several
 * roads — thumbed in off a television, pasted with a stray space, prefilled
 * from a scanned Join Link — and every one of them should land on the same four
 * tiles. It matches `joinRoom`'s own normalisation, so what the tiles show is
 * what the server will look a room up by.
 *
 * The alphabet it filters by is what a code may *hold*
 * (`ROOM_CODE_ACCEPTED_ALPHABET`), which is also the full alphabet new codes
 * are minted from. Keeping this contract at A–Z means a pre-existing code from
 * the former no-I mitigation remains typeable too.
 */
export function codeEntry(typed: string): string {
  return [...normalizeRoomCode(typed)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');
}

/**
 * The cell waiting for a letter — the one Soft Minimal gives the accent border and
 * the blinking caret — or `undefined` once the code is whole and no cell is
 * waiting for anything.
 */
export function activeCodeCell(entry: string): number | undefined {
  return entry.length < ROOM_CODE_LENGTH ? entry.length : undefined;
}

/** Whether the code has all its letters. */
export function isCodeComplete(entry: string): boolean {
  return entry.length === ROOM_CODE_LENGTH;
}

/**
 * Whether a code edit crossed the point at which the nickname should take the
 * keyboard. Keeping this transition pure makes the screen's focus hand-off
 * explicit without putting a TextInput ref in the join-entry rules.
 */
export function shouldMoveToNickname(previousCode: string, nextCode: string): boolean {
  return !isCodeComplete(previousCode) && isCodeComplete(nextCode);
}

/**
 * The nickname as the field holds it: capped at the longest name a room
 * accepts, because a client that lets someone type a name the server will
 * refuse is a client that lies.
 *
 * Counted in characters rather than UTF-16 units, exactly as `joinRoom` counts
 * it, so a name written in emoji is cut where its owner would say it ends.
 */
export function nicknameEntry(typed: string): string {
  return [...typed].slice(0, NICKNAME_MAX_LENGTH).join('');
}

/**
 * Whether Join is worth tapping: a whole code, and a name with something in it.
 *
 * The screen asks the server anyway — this is a courtesy to whoever is typing,
 * not a rule. The rules are `joinRoom`'s (see convex/convex/players.ts).
 */
export function canJoin(code: string, nickname: string): boolean {
  return isCodeComplete(code) && nickname.trim() !== '';
}
