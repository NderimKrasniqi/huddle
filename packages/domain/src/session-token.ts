import type { RandomSource } from './room-code';

/**
 * The Session Token format: the random string `joinRoom` mints for a player and
 * the Phone keeps on the phone. It is the whole of Huddle's identity
 * (docs/tech-stack.md) — presenting it is what makes a phone that has just been
 * force-quit and reopened the *same* player rather than a second one.
 *
 * It lives here beside the Room Code because both are minted server-side and
 * carried by the Phone, and because generation is then a plain function a
 * unit test can pin.
 *
 * Nothing about the format is meant for human eyes: unlike a Room Code, a
 * Session Token is never read off a television or typed, so it is spelled in
 * lower-case letters and digits — safe in a URL, a header or a storage key —
 * and made long rather than short.
 */
export const SESSION_TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Characters per Session Token. Twenty-four over a 36-character alphabet spans
 * 36^24 values, which is why `joinRoom` inserts a freshly drawn token without
 * first asking whether some other player holds it: the read-then-draw loop
 * `rooms.openRoom` needs for its 456,976 Room Codes would be checking against a
 * collision that does not happen.
 *
 * Read that as headroom against collisions, not as 124 bits of entropy. The
 * draws come from `Math.random`, which inside a Convex mutation is Convex's
 * seeded generator (see `generateSessionToken`), so what an attacker would have
 * to guess is that generator's per-execution seed rather than the 124 bits the
 * length suggests. Length past the seed buys separation between tokens, which
 * is what the no-loop insert relies on; it does not buy unguessability.
 */
export const SESSION_TOKEN_LENGTH = 24;

/**
 * One random Session Token.
 *
 * The randomness is `Math.random`, exactly as the Room Code draw uses it. Inside
 * a Convex mutation that is Convex's own seeded generator rather than the
 * platform's — strong, and reseeded per function execution, but a PRNG and not
 * `crypto.getRandomValues`. That is a deliberate call at this scope: the token
 * guards a nickname at a house party, the product holds no sensitive data by
 * design (docs/project-scope.md), and the Web Crypto path is not documented as
 * usable from a mutation, whose determinism contract is the reason `Math.random`
 * is seeded in the first place. If Huddle ever grows something worth stealing,
 * this is the function to change, and only this one.
 */
export function generateSessionToken(random: RandomSource = Math.random): string {
  let token = '';
  for (let position = 0; position < SESSION_TOKEN_LENGTH; position += 1) {
    const characterIndex = Math.floor(random() * SESSION_TOKEN_ALPHABET.length);
    token += SESSION_TOKEN_ALPHABET.charAt(characterIndex);
  }
  return token;
}
