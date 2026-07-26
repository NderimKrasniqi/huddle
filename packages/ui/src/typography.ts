/**
 * Bungee for display (always all-caps), Space Grotesk for body and UI.
 *
 * Each weight is its own family name because React Native does not synthesise
 * weights for custom fonts on Android — `fontWeight: '700'` on a loaded family
 * is silently ignored, so the weight has to be chosen by family.
 * These are the keys `fonts.ts` registers the font assets under.
 */
export const fontFamily = {
  display: 'Bungee_400Regular',
  body: 'SpaceGrotesk_400Regular',
  bodyMedium: 'SpaceGrotesk_500Medium',
  bodyBold: 'SpaceGrotesk_700Bold',
} as const;

/**
 * The smallest legible body size per surface: TV text is read from across a
 * room (≥18px at the 1280×720 design size), phone text from the hand.
 */
export const minBodyFontSize = {
  tv: 18,
  phone: 14,
} as const;

/** Letter spacing for Boardwalk's all-caps labels. */
export const letterSpacing = {
  /** 2px — small uppercase field labels ("ROOM CODE", "YOUR NAME"). */
  label: 2,
  /** 3px — pill badges ("GRAB YOUR PHONE!"). */
  badge: 3,
  /** 5px — the room-code chip. */
  roomCode: 5,
} as const;
