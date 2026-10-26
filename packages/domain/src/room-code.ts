export const ROOM_CODE_MINT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ROOM_CODE_ACCEPTED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const ROOM_CODE_LENGTH = 4;

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export type RandomSource = () => number;

export function generateRoomCode(random: RandomSource = Math.random): string {
  let code = '';
  for (let position = 0; position < ROOM_CODE_LENGTH; position += 1) {
    const letterIndex = Math.floor(random() * ROOM_CODE_MINT_ALPHABET.length);
    code += ROOM_CODE_MINT_ALPHABET.charAt(letterIndex);
  }
  return code;
}
