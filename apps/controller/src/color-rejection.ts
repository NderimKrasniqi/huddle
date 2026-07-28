import type { ColorRejection } from '@huddle/game-core';
import { ConvexError } from 'convex/values';

/**
 * What the picker says when a color does not become the player's.
 *
 * Built exactly like `join-rejection.ts`, and for the same reason: the failure
 * is told apart by `kind` off `ConvexError.data`, never by matching a message
 * somebody may reword.
 */

/** When the failure is not one of the server's answers, but the trip itself. */
const UNEXPECTED_FAILURE = 'Could not reach the room. Check your connection and try again.';

/**
 * The `kind`s as values. Keyed by the union so a kind added to `ColorRejection`
 * and not to this record is a compile error rather than a silent fall-through
 * to the generic line.
 */
const REJECTION_KINDS: Readonly<Record<ColorRejection['kind'], true>> = {
  colorTaken: true,
  colorUnknown: true,
  notInRoom: true,
};

/** Whether `data` off a `ConvexError` is one of `claimColor`'s refusals. */
function isColorRejection(data: unknown): data is ColorRejection {
  return (
    typeof data === 'object' &&
    data !== null &&
    'kind' in data &&
    typeof data.kind === 'string' &&
    // Own properties only, as in `join-rejection.ts`: every object has a
    // `toString`, and a rejection of that kind is not one of ours.
    Object.hasOwn(REJECTION_KINDS, data.kind)
  );
}

/**
 * A refusal in the words the player reads.
 *
 * Only `colorTaken` is a sentence anybody should meet: the picker dims what is
 * held, so reaching it means two thumbs landed on the same swatch inside a
 * round trip. The other two are the server declining to trust its callers, and
 * no correct Controller produces them — they get a line anyway, because a
 * silent tap is the one outcome a player cannot make sense of.
 */
export function rejectionMessage(rejection: ColorRejection): string {
  switch (rejection.kind) {
    case 'colorTaken':
      return 'Somebody just took that one. Pick another.';
    case 'colorUnknown':
      return 'That color is not one of this room’s. Pick another.';
    case 'notInRoom':
      return 'You are not in this room any more. Reopen Huddle to join again.';
  }
}

/** What to show when `claimColor` throws, whatever it threw. */
export function claimFailureMessage(error: unknown): string {
  return error instanceof ConvexError && isColorRejection(error.data)
    ? rejectionMessage(error.data)
    : UNEXPECTED_FAILURE;
}
