/**
 * How long a deserted room outlives the party — the plan's pinned ten minutes
 * (docs/implementation-plan.md).
 *
 * It sits beside the presence numbers because it is the third and longest of
 * the same family: `HEARTBEAT_INTERVAL_MS` is how often a phone speaks,
 * `AWAY_AFTER_MS` is how long the room waits before saying a phone has gone
 * quiet, and this is how long it waits before concluding the party is over.
 * The clock runs from the last heartbeat the room heard from anybody, so the
 * two are measured on the same timeline and `room-expiry.test.ts` holds them
 * apart.
 *
 * Ten minutes is long enough for the interruptions a party actually has — a
 * round of drinks, a phone call taken outside, a wifi router rebooted — and
 * short enough that a room nobody is coming back to does not keep its Room Code
 * out of the pool for the evening.
 */
export const ROOM_EXPIRY_MS = 600_000;
