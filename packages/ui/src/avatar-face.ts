import type { AvatarId } from '@huddle/contracts';

import { colors } from './colors';

/**
 * The colour an avatar brings with it, for the surfaces that need one.
 *
 * Most places draw the artwork itself and need nothing here. A few draw
 * *something about* a player where the picture will not fit — trivia's name
 * pills are the case that exists today — and those used to read the colour the
 * player had claimed. There is no claimed colour any more, so the tint comes
 * from the avatar instead, which is the honest answer: the avatar *is* how a
 * player is told apart now.
 *
 * The fills are sampled from the artwork rather than invented, so a pill beside
 * a fox is the fox's own peach. Every one of them is a pale tint that measures
 * 12:1 or better against the navy and under 1.5:1 against white, which is why
 * the ink is not a per-avatar decision the way Soft Minimal's was: white would
 * disappear on all ten.
 *
 * `packages/ui/src` is the one place a colour may be written down, which is why
 * these live here as literals rather than in the asset map beside the artwork.
 */
export type AvatarFace = {
  /** The block of colour the avatar's artwork sits on. */
  readonly fill: string;
  /** The colour text on that fill is set in. */
  readonly ink: string;
};

const FILLS: Record<AvatarId, string> = {
  fox: '#FCE0D0',
  'green-alien': '#CBECBC',
  'pink-bunny': '#FDE2DE',
  'blue-robot': '#BAD6FA',
  'purple-owl': '#E8D3EE',
  // Sampled at #F9F5F1, which is the canvas — this avatar has no tint of its
  // own and is flagged for re-art in packages/ui/assets/README.md. The peach
  // below is a stand-in so it is at least visible; it is not its real colour.
  'yellow-robot': '#FDEFD2',
  'red-robot': '#FCD7C7',
  'teal-bear': '#C9E5DF',
  'mint-cat': '#DBF0E9',
  puppy: '#FDE8CE',
};

/**
 * The plain face, for a row about somebody the roster no longer holds.
 *
 * A game's scoreboard outlives the seat: a player who leaves mid-game still has
 * a score, and the row that shows it has a nickname to fall back on and no
 * avatar at all. Soft Minimal met the same need for the opposite reason — a colour
 * was claimed after joining, so a seat existed before the choice did.
 */
const NO_AVATAR: AvatarFace = { fill: colors.border, ink: colors.ink };

/** How a player is drawn where their avatar's artwork will not fit. */
export function avatarFace(avatar: AvatarId | undefined): AvatarFace {
  return avatar === undefined ? NO_AVATAR : { fill: FILLS[avatar], ink: colors.ink };
}
