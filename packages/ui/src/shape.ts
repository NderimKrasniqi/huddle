/**
 * Boardwalk's thick ink borders. Every bordered surface picks one of these
 * three; nothing in the system uses a 1px line.
 */
export const borderWidth = {
  /** 2px — small phone elements: code tiles, chips. */
  thin: 2,
  /** 3px — phone cards, buttons, inputs, and dashed empty slots. */
  medium: 3,
  /** 4px — TV cards. */
  thick: 4,
} as const;

/** Boardwalk's corner radii, named by the surfaces the handoff applies them to. */
export const radius = {
  /** 10px — chips and the smallest elements. */
  chip: 10,
  /** 16px — inputs and list rows. */
  input: 16,
  /** 18px — primary buttons. */
  button: 18,
  /** 20px — larger list rows and panels. */
  row: 20,
  /** 24px — cards: code tiles, the QR card. */
  card: 24,
  /** 28px — large TV cards: player cards, carousel cards. */
  cardLarge: 28,
  /** Fully rounded pill badges: HOST, JUST JOINED!, GRAB YOUR PHONE!, chips. */
  pill: 999,
} as const;

/**
 * Boardwalk dims what a player cannot have rather than hiding or greying it —
 * the handoff sets claimed color swatches to "30% opacity", and anything else
 * that is present but not currently available (a Join button with no code in
 * the tiles yet) reads the same way.
 */
export const opacity = {
  unavailable: 0.3,
  /**
   * 50% — the carousel's side cards (handoff §6). A separate number from
   * `unavailable` on purpose: a neighbouring game is not unavailable, it is
   * merely not the one being looked at, and the two would drift the moment one
   * of those meanings changed.
   */
  carouselSideCard: 0.5,
} as const;

/**
 * Boardwalk tilts cards and badges like stickers pressed onto the screen
 * (`rotate(-3deg…3deg)`). Named per surface so the same element is never tilted
 * two different ways on two different screens; the room-code tiles get their
 * tilt from `codeTileTilt` instead, because theirs cycles by position.
 */
export const stickerTilt = {
  /** -3° — the "GRAB YOUR PHONE!" badge. */
  badge: '-3deg',
  /** 1.5° — the TV's QR card. */
  qrCard: '1.5deg',
  /**
   * 2° — a status chip that replaces a line of caption text (the TV's
   * "reconnecting" chip). Leans the other way from the badge above it, per the
   * handoff's alternating sibling tilts.
   */
  statusChip: '2deg',
  /**
   * -2° — the carousel's side cards (handoff §6, "tilted"). Inside Boardwalk's
   * -3°…3° range and shallower than the badge, so a card standing back from the
   * focused one does not out-lean the loudest sticker on the screen.
   */
  carouselSideCard: '-2deg',
  /**
   * 2° — trivia's countdown tile, the one number a whole room reads at once.
   * Its own entry rather than the status chip's, per this table's rule: two
   * surfaces sharing a number is how one of them ends up re-tilted by a change
   * meant for the other.
   */
  countdownTile: '2deg',
} as const;
