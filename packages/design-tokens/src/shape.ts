/**
 * Soft Minimal draws one border weight, and it is a hairline.
 *
 * Soft Minimal had three — 2, 3 and 4px of ink — and the weight was the system's
 * signature. Here a border is a divider rather than a statement: warm grey at
 * 1px, doing the job the old ink did with contrast that the shadow and the
 * surface's own fill now carry between them.
 *
 * `focus` is the exception and the only place a border is meant to be seen from
 * across a room: the handoff pins TV focus at a 3px orange border plus a 1.04
 * scale, and is explicit that scale alone is not enough.
 */
export const borderWidth = {
  /** 1px — every bordered surface. */
  hairline: 1,
  /** 3px — a focused TV card or action, in the accent. */
  focus: 3,
} as const;

/**
 * Soft Minimal's corner radii, named by the surfaces the handoff applies them
 * to. The names are Soft Minimal's; the values follow its bands — chips 8–12,
 * inputs and buttons 12–16, cards and sheets 18–24.
 *
 * Keeping the names was not laziness. A radius token says *what kind of thing
 * this is*, and that did not change when the system did: a chip is still the
 * smallest rounded thing on a screen and a card is still a card. Renaming them
 * would have churned every call site to say the same thing in new words.
 */
export const radius = {
  /** 10px — chips and the smallest elements. */
  chip: 10,
  /** 14px — inputs. */
  input: 14,
  /** 14px — primary buttons. */
  button: 14,
  /** 16px — list rows and panels. */
  row: 16,
  /** 20px — cards: code tiles, the QR card, sheets. */
  card: 20,
  /** 24px — large TV cards: player cards, carousel cards. */
  cardLarge: 24,
  /** Fully rounded pill badges and chips. */
  pill: 999,
} as const;

/**
 * Soft Minimal dims what a player cannot use rather than hiding or greying it.
 * Anything present but not currently available (a Join button with no complete
 * code, for example) reads the same way.
 */
export const opacity = {
  unavailable: 0.3,
  /**
   * 50% — the carousel's side cards. A separate number from
   * `unavailable` on purpose: a neighbouring game is not unavailable, it is
   * merely not the one being looked at, and the two would drift the moment one
   * of those meanings changed.
   */
  carouselSideCard: 0.5,
  /**
   * 45% — the ink scrim behind a modal (the Host Roster's manage sheet). Its own
   * name for the same reason the two above have theirs: a scrim dims *the room
   * behind a dialog*, which is neither a thing made unavailable nor a card
   * standing back, so a shared number would drift the moment one meaning moved.
   */
  scrim: 0.45,
  /**
   * 88% — a white chip laid over a game's key art (the phone's picker card).
   * Its own name for the same reason as the three above: this is a surface
   * letting the art read *through* it, which is the opposite of a thing made
   * unavailable, and at full strength it punches a hole in the card it is on.
   */
  chipOnArt: 0.88,
} as const;
