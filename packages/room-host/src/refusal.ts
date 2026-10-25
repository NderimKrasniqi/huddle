import type { RoomRejection } from '@huddle/contracts/protocol';

/** Thrown by a rule to refuse a command; the dispatcher turns it into a result. */
export class Refusal {
  constructor(readonly rejection: RoomRejection) {}
}
