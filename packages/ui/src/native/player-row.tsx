import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import type { AvatarId } from '@huddle/contracts';
import { View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

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
  readonly compact?: boolean;
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
  compact = false,
  style,
  testID,
}: PlayerRowProps) {
  const presence = presenceCopy[status];
  return (
    <View testID={testID} focusable={false} style={[styles.row, compact ? styles.compactRow : null, style]}>
      <AvatarPortrait avatarId={avatarId} displayName={displayName} size={compact ? 36 : 48} />
      <View focusable={false} style={compact ? styles.compactIdentity : styles.identity}>
        <HuddleText variant={compact ? 'body' : 'body'} color="text" numberOfLines={1}>{displayName}</HuddleText>
        {compact ? (
          <HuddleText variant="caption" style={styles.compactMeta}>{isHost ? 'Host' : presence.label}</HuddleText>
        ) : (
          <View focusable={false} style={styles.meta}>
            <Badge label={presence.label} tone={presence.tone} />
            {isHost ? <Badge label="Host" tone="host" /> : null}
          </View>
        )}
      </View>
      {compact ? <HuddleText variant="title" style={[styles.compactStatus, isHost ? styles.compactHost : null]} accessibilityElementsHidden>{isHost ? '♛' : status === 'ready' ? '✓' : status === 'away' ? '◷' : '•'}</HuddleText> : null}
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
  compactRow: {
    minHeight: 56,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: semanticColors.border,
    borderRadius: radii.md,
    gap: spacing.sm,
  } satisfies ViewStyle,
  identity: {
    flex: 1,
    gap: spacing.xs,
  } satisfies ViewStyle,
  compactIdentity: {
    flex: 1,
    gap: 0,
  } satisfies ViewStyle,
  compactMeta: {
    opacity: 0.72,
  } satisfies TextStyle,
  compactStatus: {
    fontSize: 18,
    lineHeight: 22,
    color: semanticColors.success,
  } satisfies TextStyle,
  compactHost: {
    color: semanticColors.primary,
  } satisfies TextStyle,
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
