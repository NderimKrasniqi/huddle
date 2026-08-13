/**
 * The longest nickname a room will hold, in characters.
 *
 * The number is a bound on abuse rather than a layout measurement: `joinRoom`
 * is directly callable by anything that can reach the backend — Huddle has no
 * auth by design (docs/tech-stack.md) — so an unbounded nickname is a string
 * the server stores and pushes to every client on every roster update. Twenty
 * characters is far longer than anyone types on a phone at a party and sits
 * comfortably inside the lobby cards that show a name in full, so no real
 * player ever meets this rule.
 *
 * It lives in game-core beside the Room Code format for the same reason: the
 * Phone's name input caps itself at the same number, and a client that
 * lets someone type a name the server will refuse is a client that lies.
 */
export const NICKNAME_MAX_LENGTH = 20;
