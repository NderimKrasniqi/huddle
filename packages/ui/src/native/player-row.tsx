import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import type { AvatarId } from '@huddle/contracts';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AvatarPortrait } from './avatar-portrait';
import { Badge, type HuddleBadgeTone } from './badge';
import { HuddleButton, type HuddleButtonVariant } from './huddle-button';
import { HuddleText } from './huddle-text';

export type PlayerPresence = 'waiting' | 'joining' | 'ready' | 'away';

export type PlayerRowAction = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: HuddleButtonVariant;
  readonly disabled?: boolean;
  readonly busy?: boolean;
};

export type PlayerRowProps = {
  readonly displayName: string;
  readonly avatarId: AvatarId;
  readonly status?: PlayerPresence;
  readonly isHost?: boolean;
  readonly action?: PlayerRowAction;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
};

const presenceCopy: Record<PlayerPresence, { label: string; tone: HuddleBadgeTone }> = {
  waiting: { label: 'Waiting', tone: 'neutral' },
  joining: { label: 'Joining', tone: 'neutral' },
  ready: { label: 'Ready', tone: 'ready' },
  away: { label: 'Away', tone: 'away' },
};

/** Roster row shared by the Phone lobby and the TV's passive roster view. */
export function PlayerRow({
  displayName,
  avatarId,
  status = 'waiting',
  isHost = false,
  action,
  style,
  testID,
}: PlayerRowProps) {
  const presence = presenceCopy[status];
  return (
    <View testID={testID} focusable={false} style={[styles.row, style]}>
      <AvatarPortrait avatarId={avatarId} displayName={displayName} size={48} />
      <View focusable={false} style={styles.identity}>
        <HuddleText variant="body" color="text" numberOfLines={1}>{displayName}</HuddleText>
        <View focusable={false} style={styles.meta}>
          <Badge label={presence.label} tone={presence.tone} />
          {isHost ? <Badge label="Host" tone="host" /> : null}
        </View>
      </View>
      {action ? (
        <HuddleButton
          title={action.label}
          variant={action.variant ?? 'ghost'}
          onPress={action.onPress}
          disabled={action.disabled}
          busy={action.busy}
          accessibilityLabel={`${action.label} ${displayName}`}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = {
  row: {
    minHeight: 72,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: semanticColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  } satisfies ViewStyle,
  identity: {
    flex: 1,
    gap: spacing.xs,
  } satisfies ViewStyle,
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  } satisfies ViewStyle,
  action: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    ...shadows.none,
  } satisfies ViewStyle,
} as const;
