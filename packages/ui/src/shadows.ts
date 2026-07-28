/**
 * Where Boardwalk's signature shadow sits: `N` down and `N` right of the
 * surface it falls from, hard-edged and never blurred — ink by default, but
 * sometimes an accent (pink on the "JUST JOINED!" card, cobalt on the focused
 * carousel card).
 *
 * This used to return a React Native `boxShadow` value. It was replaced while
 * chasing the pale hairline that shows where a card's ink border meets its ink
 * shadow, on the theory that an outset `box-shadow` gets clipped to the
 * surface's rounded rect and that the clip edge and the border's own edge, both
 * antialiased on the same curve, sum to less than opaque. **That theory was
 * wrong**: drawing the shadow as an opaque sibling rect instead left the seam
 * byte-identical. The real cause is on the surface itself and is fixed in
 * `StickerSurface` (`@huddle/ui/native`), which documents it.
 *
 * The rect form is kept anyway, because it is what `StickerSurface` needs to
 * paint the shadow as a plain sibling view — and describing the shadow as data
 * rather than as a style value keeps this module runnable under Node, with the
 * component that consumes it the only part that needs React.
 */

/**
 * The shadow rectangle's insets, ready to spread into an absolutely positioned
 * style. Negative `right`/`bottom` are what make it the same size as the
 * surface rather than a smaller rect inside it.
 */
export type ShadowRect = {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
};

/**
 * A shadow rect displaced `distance` down and right, identical in size to the
 * surface it falls from.
 *
 * Callers pass a `shadowDepth` preset. A distance of 0 is legal and puts the
 * shadow exactly behind the surface, which hides it — that is how a pressed
 * button with no travel left would read, rather than an error.
 */
export function stickerShadowRect(distance: number): ShadowRect {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError(`shadow distance must be a non-negative number, got ${distance}`);
  }

  // Negating 0 gives -0, which is harmless in a style but leaks a value that
  // compares unequal to 0 under `Object.is`, so flatten it here rather than
  // making every consumer wonder.
  const far = distance === 0 ? 0 : -distance;

  return { top: distance, left: distance, right: far, bottom: far };
}

/**
 * Every shadow distance the handoff gives a number for, named by the surface
 * it belongs to. Where the handoff asks for a shadow without naming a distance
 * (the room-code chip, the color swatches, the game picker's round buttons),
 * use the preset for that surface.
 */
export const shadowDepth = {
  /** 3px — small phone elements: inputs, roster rows, chips. */
  phoneSmall: 3,
  /** 4px — phone cards and primary buttons. */
  phoneCard: 4,
  /** 5px — the phone's hero avatar circle on "You're in". */
  phoneHero: 5,
  /** 6px — TV cards: code tiles, player cards, the QR card. */
  tvCard: 6,
  /** 8px — a highlighted TV card, in its accent color (the "JUST JOINED!" card). */
  tvCardHighlight: 8,
  /** 10px — the TV hero card (the focused carousel card). */
  tvHero: 10,
} as const;
