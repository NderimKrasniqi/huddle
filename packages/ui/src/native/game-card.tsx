import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import { HuddleText } from './huddle-text';
import {
  Image,
  Pressable,
  View,
  type ImageSourcePropType,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type GameCardTone = 'trivia' | 'voting' | 'doodleDash' | 'quickPoll' | 'hotTake';

export type GameCardProps = {
  readonly title: string;
  readonly description?: string;
  readonly metadata?: readonly string[];
  readonly image: ImageSourcePropType;
  readonly tone?: GameCardTone;
  readonly selected?: boolean;
  readonly comingSoon?: boolean;
  readonly disabled?: boolean;
  readonly onPress?: PressableProps['onPress'];
  readonly interactive?: boolean;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
};

const toneColors: Record<GameCardTone, keyof typeof semanticColors> = {
  trivia: 'success',
  voting: 'highlight',
  doodleDash: 'secondary',
  quickPoll: 'accent',
  hotTake: 'primary',
};

/** Native game card with text-free artwork and explicit Coming soon state. */
export function GameCard({
  title,
  description,
  metadata,
  image,
  tone = 'trivia',
  selected = false,
  comingSoon = false,
  disabled = false,
  onPress,
  interactive = true,
  accessibilityLabel,
  testID,
  style,
}: GameCardProps) {
  const cardDisabled = disabled || comingSoon;
  const backgroundColor = semanticColors[toneColors[tone]];
  const label = accessibilityLabel ?? [
    title,
    comingSoon ? 'Coming soon' : undefined,
    selected ? 'Selected' : undefined,
    description,
    metadata && metadata.length > 0 ? metadata.join(', ') : undefined,
  ].filter((part): part is string => Boolean(part)).join('. ');
  const content = (
    <>
      {comingSoon || selected ? (
        <View style={[styles.stateMark, styles.cardStateMark, comingSoon ? styles.comingSoonMark : styles.selectedMark]} accessible={false}>
          <HuddleText variant="title" color="surface" style={styles.stateMarkText}>{comingSoon ? '−' : '✓'}</HuddleText>
        </View>
      ) : null}
      <View style={styles.artFrame}>
        <Image source={image} resizeMode="contain" accessible={false} style={styles.art} />
      </View>
      <View style={styles.copy}>
        <View style={styles.headingRow}>
          <HuddleText variant="title" color="text" numberOfLines={1}>{title}</HuddleText>
        </View>
        {description ? <HuddleText variant="body" color="text" numberOfLines={2}>{description}</HuddleText> : null}
        {metadata && metadata.length > 0 ? (
          <HuddleText variant="caption" color="text">{metadata.join(' • ')}</HuddleText>
        ) : null}
      </View>
    </>
  );
  const cardStyle = [
    styles.card,
    { backgroundColor },
    selected ? styles.selected : null,
    cardDisabled ? styles.disabled : null,
    style,
  ];

  if (onPress === undefined || !interactive) {
    return (
      <View testID={testID} pointerEvents="none" focusable={false} accessible accessibilityRole="image" accessibilityLabel={label} style={cardStyle}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={cardDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: cardDisabled, selected }}
      style={({ pressed }) => [cardStyle, pressed && !cardDisabled ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

const styles = {
  card: {
    minHeight: 220,
    padding: spacing.md,
    borderRadius: radii.xl,
    justifyContent: 'space-between',
    ...shadows.card,
  } satisfies ViewStyle,
  artFrame: {
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  art: {
    width: '100%',
    height: '100%',
  },
  copy: {
    gap: spacing.xs,
  } satisfies ViewStyle,
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  } satisfies ViewStyle,
  stateMark: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  cardStateMark: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
  } satisfies ViewStyle,
  selectedMark: {
    backgroundColor: semanticColors.success,
  } satisfies ViewStyle,
  comingSoonMark: {
    backgroundColor: semanticColors.accent,
  } satisfies ViewStyle,
  stateMarkText: {
    fontSize: 18,
    lineHeight: 20,
  } satisfies TextStyle,
  selected: {
    borderWidth: 3,
    borderColor: semanticColors.text,
  } satisfies ViewStyle,
  disabled: {
    opacity: 0.52,
    shadowOpacity: 0,
    elevation: 0,
  } satisfies ViewStyle,
  pressed: {
    transform: [{ scale: 0.98 }],
  } satisfies ViewStyle,
} as const;
