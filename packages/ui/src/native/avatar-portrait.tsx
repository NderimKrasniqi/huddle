import { playroomAvatarCircles, playroomColors, playroomShadows } from '@huddle/design-tokens';
import type { AvatarId } from '@huddle/contracts';
import type { ComponentType, ComponentProps } from 'react';
import {
  Image,
  Pressable,
  View,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PLAYROOM_AVATARS } from './playroom-artwork';

// React Native's ImageProps omit the View focusable flag even though the
// Android ImageView can otherwise become a D-pad target. Keep the explicit
// passive flag in the rendered host props without weakening the public type.
const HuddleImage = Image as unknown as ComponentType<ComponentProps<typeof Image> & {
  readonly focusable?: boolean;
}>;

export type AvatarPortraitProps = {
  readonly avatarId: AvatarId;
  readonly source?: ImageSourcePropType;
  readonly size?: number;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly displayName?: string;
  readonly onPress?: () => void;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly imageStyle?: StyleProp<ImageStyle>;
};

/** Collectible avatar portrait that becomes a button only when requested. */
export function AvatarPortrait({
  avatarId,
  source = PLAYROOM_AVATARS[avatarId],
  size = 56,
  selected = false,
  disabled = false,
  displayName,
  onPress,
  testID,
  style,
  imageStyle,
}: AvatarPortraitProps) {
  const label = displayName === undefined ? `${avatarId} avatar` : `${displayName}'s avatar`;
  // The character sits on its pastel circle, drawn 1.3× and shifted up so
  // the face fills the circle, as on the platform screens.
  const image = (
    <View
      focusable={false}
      accessible={onPress === undefined}
      accessibilityRole={onPress === undefined ? 'image' : undefined}
      accessibilityLabel={onPress === undefined ? label : undefined}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: playroomAvatarCircles[avatarId] }]}
    >
      <HuddleImage
        source={source}
        resizeMode="contain"
        // The image is either a child of the interactive Pressable below or a
        // passive portrait. It must never become a second Android TV D-pad
        // target in either case.
        focusable={false}
        accessible={false}
        style={[styles.image, portraitBox(size, avatarId), imageStyle]}
      />
    </View>
  );
  const frameStyle = [
    styles.frame,
    { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 },
    selected ? styles.selected : null,
    disabled ? styles.disabled : null,
    style,
  ];

  if (onPress === undefined) {
    return <View testID={testID} focusable={false} style={frameStyle}>{image}</View>;
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      style={({ pressed }) => [frameStyle, pressed && !disabled ? styles.pressed : null]}
    >
      {image}
    </Pressable>
  );
}

/** Art that fills more of its square than the rest is drawn smaller; see PlayroomAvatar. */
const PORTRAIT_FIT: Partial<Record<string, number>> = { puppy: 0.96, 'green-alien': 0.9 };

function portraitBox(size: number, avatarId: string): ImageStyle {
  const drawn = size * 1.3 * (PORTRAIT_FIT[avatarId] ?? 1);
  const shift = size * 1.3 - drawn;
  return { width: drawn, height: drawn, left: -size * 0.15 + shift / 2, top: -size * 0.2 + shift };
}

const styles = {
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playroomColors.surface,
    borderColor: 'transparent',
    borderWidth: 2,
  } satisfies ViewStyle,
  circle: {
    overflow: 'hidden',
  } satisfies ViewStyle,
  image: {
    position: 'absolute',
    backgroundColor: 'transparent',
  } satisfies ImageStyle,
  selected: {
    borderColor: playroomColors.orange,
    ...playroomShadows.card,
  } satisfies ViewStyle,
  disabled: {
    opacity: 0.38,
  } satisfies ViewStyle,
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  } satisfies ViewStyle,
} as const;
