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

/**
 * How long a room nobody has ever joined is held for the television showing its
 * code.
 *
 * A second number rather than a reuse of the first, because the first cannot be
 * asked here: the ten minutes run from the last heartbeat the room heard, and a
 * room with no players has never heard one. That is the whole of why an unjoined
 * room used to be held forever — and forever is a Room Code spent forever, since
 * `createRoom` draws against live rooms.
 *
 * Two hours because the only thing this clock can get wrong is taking a code off
 * a screen somebody is reading it from, and the guests of a party arrive within
 * minutes of the television being switched on, never hours. A join at any point
 * inside the window ends it for good — the room is on the ten-minute clock from
 * then on — so this is only ever reached by a television nobody is playing on,
 * where the cost of being wrong is that the TV opens a fresh room and shows a
 * fresh code.
 *
 * There is no third possibility available: nothing but a phone ever speaks to a
 * room, so a television left on and a television switched off are the same
 * silence, and the only question is how long to wait it out.
 */
export const UNJOINED_ROOM_EXPIRY_MS = 7_200_000;
