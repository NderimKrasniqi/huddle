/**
 * The carousel's Card Transition, as logic: which way the cards slide when the
 * room's Browsing Game Index moves.
 *
 * The handoff asks for it in one line — "host phone prev/next (or swipe) drives
 * the TV carousel in real time via room state (`browsingGameIndex`); TV animates
 * card transition ~250ms ease-out" — and the direction is the only part of that
 * a television has to work out. The duration and the easing belong to the
 * animation (`motionDuration.cardTransition`); this is the sign in front of
 * them, and it is here rather than inside the screen because it is arithmetic
 * over two numbers and everything of that shape in this app is testable.
 *
 * The row carries no state of its own between renders — Convex pushes the index
 * and the carousel draws it — so "which way" is the difference between the index
 * being drawn and the one drawn before it, which is what the screen keeps.
 */

/**
 * How far, in design points, the cards start from where they land.
 *
 * Deliberately shorter than a card's own pitch (the focused card is 440 wide
 * with a 28pt gap), which a true scroll would use. The row is centred and its
 * width changes as neighbours appear and disappear at the ends of the registry,
 * so a full-pitch slide would only line up in the middle of a long list and
 * would overshoot the screen everywhere else. A short slide says which way the
 * room went on every list length, which is what the animation is for.
 */
export const CARD_ENTRY_TRAVEL = 96;

/**
 * Where the carousel's cards start, given the index they were drawing and the
 * one they are drawing now.
 *
 * Positive is to the right: browsing forward scrolls the strip left, so its
 * cards come from the right and settle at 0. The magnitude is the same however
 * far the index jumped, because the room's stored index is clamped to what this
 * build installs and a phone on a longer registry can move it several cards at
 * once — the transition says direction, not distance.
 *
 * A mount has no `from` to compare and is not asked: the screen seeds itself
 * with the index it is already drawing, so a carousel that has just appeared
 * starts at an offset of 0 without this function being called at all.
 */
export function cardEntryOffset(from: number, to: number): number {
  if (from === to) {
    return 0;
  }

  return to > from ? CARD_ENTRY_TRAVEL : -CARD_ENTRY_TRAVEL;
}
