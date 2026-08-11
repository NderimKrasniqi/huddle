/**
 * Cards that are shown for reference coverage before their games are installed.
 *
 * This small, server-safe catalog is shared by the client carousel and the
 * Convex index clamp. Keeping the count here means a room can browse the same
 * four positions on both sides of the app without importing React Native
 * screens into the server bundle.
 */
export const CAROUSEL_PLACEHOLDER_IDS = ['draw-battle', 'word-sneak'] as const;

export const CAROUSEL_PLACEHOLDER_COUNT = CAROUSEL_PLACEHOLDER_IDS.length;
