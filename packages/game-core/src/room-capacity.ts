/**
 * How many players a room seats — the plan's pinned default
 * (docs/implementation-plan.md).
 *
 * It lives here, beside the Room Code format, because both sides of the
 * protocol count against it: `joinRoom` turns the eleventh phone away, and the
 * TV's roster footer reads "N of 10 joined". Two copies of the number is how
 * the TV ends up promising a seat the backend refuses.
 *
 * Game modules declare their own player range on top of this (trivia: 2–10,
 * Phase 3); this is the room's ceiling, which no game may exceed.
 */
export const ROOM_PLAYER_CAP = 10;
