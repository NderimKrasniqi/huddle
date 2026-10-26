import type { RandomSource } from './room-code';

const SESSION_TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const SESSION_TOKEN_LENGTH = 24;

export function generateSessionToken(random: RandomSource = Math.random): string {
  let token = '';
  for (let position = 0; position < SESSION_TOKEN_LENGTH; position += 1) {
    const characterIndex = Math.floor(random() * SESSION_TOKEN_ALPHABET.length);
    token += SESSION_TOKEN_ALPHABET.charAt(characterIndex);
  }
  return token;
}
