import { semanticColors, shadows, spacing } from '@huddle/design-tokens';
import type { AvatarId } from '@huddle/contracts';
import type { ComponentType, ComponentProps } from 'react';
import {
  Image,
  Pressable,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { huddleAvatarSource } from './avatar-source';

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
};

/** Collectible avatar portrait that becomes a button only when requested. */
export function AvatarPortrait({
  avatarId,
  source = huddleAvatarSource(avatarId),
  size = 56,
  selected = false,
  disabled = false,
  displayName,
  onPress,
  testID,
  style,
}: AvatarPortraitProps) {
  const label = displayName === undefined ? `${avatarId} avatar` : `${displayName}'s avatar`;
  const image = (
    <HuddleImage
      source={source}
      resizeMode="contain"
      // The image is either a child of the interactive Pressable below or a
      // passive portrait. It must never become a second Android TV D-pad
      // target in either case.
      focusable={false}
      accessible={onPress === undefined}
      accessibilityRole={onPress === undefined ? 'image' : undefined}
      accessibilityLabel={onPress === undefined ? label : undefined}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
  const frameStyle = [
    styles.frame,
    { width: size + spacing.sm, height: size + spacing.sm, borderRadius: (size + spacing.sm) / 2 },
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

const styles = {
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: semanticColors.surface,
    borderColor: 'transparent',
    borderWidth: 2,
  } satisfies ViewStyle,
  image: {
    backgroundColor: 'transparent',
  },
  selected: {
    borderColor: semanticColors.primary,
    ...shadows.card,
  } satisfies ViewStyle,
  disabled: {
    opacity: 0.38,
  } satisfies ViewStyle,
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  } satisfies ViewStyle,
} as const;
