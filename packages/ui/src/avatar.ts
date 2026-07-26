/**
 * Boardwalk draws a player as a circle in their claimed color with their
 * initials in Bungee (docs/design/design-handoff.md §3, §4). The color is
 * claimed in Phase 2; the monogram is a rule about the nickname, and lives here
 * with the rest of the system's per-surface treatments (see code-tile.ts) so
 * the TV's seats and the Controller's avatar never spell a player differently.
 */

/** How many letters a monogram may hold before it stops reading at TV distance. */
const MAX_INITIALS = 2;

/**
 * The initials for a nickname: the first letter of its first two words,
 * upper-cased — "ada" → "A", "Grace Hopper" → "GH".
 *
 * Total by design: every nickname the server will accept has to render into
 * something, and a caller holding an avatar has nowhere to put a failure. A
 * nickname of nothing but spaces yields no initials, and the circle is simply
 * blank.
 */
export function playerInitials(nickname: string): string {
  return nickname
    .split(/\s+/u)
    .filter((word) => word !== '')
    .slice(0, MAX_INITIALS)
    // Spread rather than `charAt`, so a nickname starting outside the basic
    // plane (an emoji, say) contributes its whole character and not half of it.
    .map((word) => [...word][0] ?? '')
    .join('')
    .toLocaleUpperCase();
}
