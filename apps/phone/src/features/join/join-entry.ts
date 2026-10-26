import {
  NICKNAME_MAX_LENGTH,
  ROOM_CODE_ACCEPTED_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
} from '@huddle/domain';

export function codeEntry(typed: string): string {
  return [...normalizeRoomCode(typed)]
    .filter((letter) => ROOM_CODE_ACCEPTED_ALPHABET.includes(letter))
    .slice(0, ROOM_CODE_LENGTH)
    .join('');
}

export function activeCodeCell(entry: string): number | undefined {
  return entry.length < ROOM_CODE_LENGTH ? entry.length : undefined;
}

export function isCodeComplete(entry: string): boolean {
  return entry.length === ROOM_CODE_LENGTH;
}

export function nicknameEntry(typed: string): string {
  return [...typed].slice(0, NICKNAME_MAX_LENGTH).join('');
}

export function canJoin(code: string, nickname: string): boolean {
  return isCodeComplete(code) && nickname.trim() !== '';
}
