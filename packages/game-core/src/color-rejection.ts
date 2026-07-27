import type { PlayerColorName } from './player-color';

/**
 * Why `claimColor` refused a swatch.
 *
 * Shaped like the Join Rejection and thrown the same way — as the `data` of a
 * `ConvexError`, the only part of a thrown error Convex does not redact — so
 * the picker tells the cases apart by `kind` rather than by a message someone
 * may reword.
 *
 * `colorTaken` is the one a player can actually meet: the picker already dims
 * every swatch somebody holds, so reaching it means two phones tapped the same
 * one inside a round trip of each other. It carries the color so the screen can
 * name it. The other two are the server refusing to trust its callers —
 * `claimColor` is public and unauthenticated by design — and no correct
 * Controller produces either.
 */
export type ColorRejection =
  | { readonly kind: 'colorTaken'; readonly color: PlayerColorName }
  | { readonly kind: 'colorUnknown'; readonly color: string }
  | { readonly kind: 'notInRoom' };
