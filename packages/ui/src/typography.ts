/**
 * Inter, in four weights, across both applications.
 *
 * Each weight is its own family name because React Native does not synthesise
 * weights for custom fonts on Android — `fontWeight: '700'` on a loaded family
 * is silently ignored, so the weight has to be chosen by family. These are the
 * keys `fonts.ts` registers the font assets under.
 *
 * There is no display face. Boardwalk had one (Bungee, always all-caps) and
 * Soft Minimal does not: the one thing that genuinely needed a second face was
 * the HUDDLE wordmark, and the handoff (§5) says the wordmark ships as brand
 * artwork rather than being recreated from a text font. Everything else that
 * was "display" — a room-code letter, a heading, a badge — is Inter at a
 * weight, which is why the roles below are weights rather than voices.
 */
export const fontFamily = {
  /** Body and status text. */
  regular: 'Inter_400Regular',
  /** Player names, and small uppercase labels like ROOM CODE. */
  medium: 'Inter_500Medium',
  /** Section headings, buttons, room-code characters. */
  semibold: 'Inter_600SemiBold',
  /** Screen titles. */
  bold: 'Inter_700Bold',
} as const;

/**
 * The smallest legible body size per surface: TV text is read from across a
 * room, phone text from the hand.
 *
 * Both are the floor of the handoff's own scale rather than a judgement laid
 * over it — phone caption is 12 and TV caption is 16, and a size under either
 * is off the scale rather than merely small. Boardwalk floored these at 14 and
 * 18, which Soft Minimal's label and caption sizes both sit under; keeping the
 * old numbers would have made the design system illegal in its own repo.
 *
 * The floors moving down is also what retires the rule's escape hatch. It used
 * to exempt anything set in `fontFamily.display`, because the Controller drew
 * its HOST pill in Bungee at 13px — under the phone floor and outside it. With
 * the floors on the scale's own smallest sizes, nothing in the scale needs
 * exempting, which is just as well: there is no display face left to claim it.
 */
export const minBodyFontSize = {
  tv: 16,
  phone: 12,
} as const;

/** Letter spacing for the handoff's all-caps labels. */
export const letterSpacing = {
  /** 2px — small uppercase field labels ("ROOM CODE", "YOUR NAME"). */
  label: 2,
  /** 3px — pill badges. */
  badge: 3,
  /** 5px — the room-code chip. */
  roomCode: 5,
} as const;
