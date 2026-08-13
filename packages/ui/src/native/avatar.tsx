import { AVATAR_IDS, type AvatarId } from '@huddle/contracts';
import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

import blueRobot from '../../assets/avatars/blue-robot.png';
import fox from '../../assets/avatars/fox.png';
import greenAlien from '../../assets/avatars/green-alien.png';
import mintCat from '../../assets/avatars/mint-cat.png';
import pinkBunny from '../../assets/avatars/pink-bunny.png';
import puppy from '../../assets/avatars/puppy.png';
import purpleOwl from '../../assets/avatars/purple-owl.png';
import redRobot from '../../assets/avatars/red-robot.png';
import tealBear from '../../assets/avatars/teal-bear.png';
import yellowRobot from '../../assets/avatars/yellow-robot.png';

/**
 * A player's avatar.
 *
 * `shape` is the whole of the difference between the two forms the design uses.
 * There is no circular artwork and none is coming: a batch ships square and
 * circular files, the circular ones are unusable, and the square asset under
 * `borderRadius: size / 2` is a better circle than they are — its background is
 * already the character's own colour family, so the circle needs no ring to
 * sit on. One asset, two shapes, and no way for them to drift apart. See
 * `packages/ui/assets/README.md`.
 *
 * The map is written out rather than built from `AVATAR_IDS` because a bundler
 * has to see every `import` statically — a path assembled from an id at runtime
 * resolves to nothing in a release build. `avatar.test.ts` holds the two lists
 * in step so a new id cannot be added without its artwork.
 */
const ARTWORK: Record<AvatarId, number> = {
  fox,
  'green-alien': greenAlien,
  'pink-bunny': pinkBunny,
  'blue-robot': blueRobot,
  'purple-owl': purpleOwl,
  'yellow-robot': yellowRobot,
  'red-robot': redRobot,
  'teal-bear': tealBear,
  'mint-cat': mintCat,
  puppy,
};

/** Every avatar that has artwork, in the order the picker draws them. */
export const AVATAR_ARTWORK_IDS = AVATAR_IDS;

export type AvatarProps = {
  readonly avatar: AvatarId;
  /** Rendered width and height in design pixels. */
  readonly size: number;
  /** `round` for presence rows and the TV strip, `tile` for the picker. */
  readonly shape?: 'round' | 'tile';
  /** The player this is, for anything that cannot see the picture. */
  readonly label?: string;
  readonly style?: StyleProp<ImageStyle>;
};

export function Avatar({ avatar, size, shape = 'round', label, style }: AvatarProps) {
  return (
    <Image
      source={ARTWORK[avatar]}
      accessibilityRole="image"
      accessibilityLabel={label}
      contentFit="cover"
      style={[
        { width: size, height: size, borderRadius: shape === 'round' ? size / 2 : size * 0.22 },
        style,
      ]}
    />
  );
}

/** The artwork for one avatar, for a surface that needs the source itself. */
export function avatarArtwork(avatar: AvatarId): number {
  return ARTWORK[avatar];
}
