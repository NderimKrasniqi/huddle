import type { AvatarId } from '@huddle/domain';
import { radii, semanticColors, spacing, typography } from '@huddle/design-tokens';
import {
  AvatarPortrait,
  Badge,
  HuddleText,
  PlatformBrandLockup,
  PlatformQrFrame,
  PlatformRail,
  PlatformRoomCode,
  PlatformStage,
} from '@huddle/ui/native';
import QRCode from 'react-native-qrcode-svg';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';

const PLAYER_CAPACITY = 10;

/** The stable roster data needed by the display-only invitation renderer. */
export type RoomInvitationPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatar?: ImageSourcePropType;
  readonly avatarId?: AvatarId;
  readonly host?: boolean;
  readonly away?: boolean;
};

export type RoomInvitationScreenProps = {
  readonly roomCode: string;
  readonly joinUrl: string;
  readonly players?: readonly RoomInvitationPlayer[];
};

/**
 * The TV invitation is a passive stage projection. The room stage is the
 * environment and every label, code, QR module, and player remains native
 * content placed directly into that environment.
 */
export function RoomInvitationScreen({
  roomCode,
  joinUrl,
  players = [],
}: RoomInvitationScreenProps) {
  const normalizedCode = roomCode.trim().toUpperCase().slice(0, 4);
  const spokenCode = normalizedCode.split('').join(' ');
  const visiblePlayers = players.slice(0, PLAYER_CAPACITY);

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible={false}
      testID="room-invitation-viewport"
    >
      <PlatformStage
        testID="room-invitation-stage"
        backgroundTestID="room-invitation-background"
        shadeOpacity={0.14}
        pointerEvents="none"
        focusable={false}
        accessible={false}
      >
        <PlatformBrandLockup markTestID="room-invitation-brand-mark" style={styles.brandRow} />

        <View style={styles.inviteColumn} pointerEvents="none" focusable={false} accessible={false}>
          <HuddleText variant="tvDisplay" color="surface" align="center" style={styles.title}>
            Join the fun!
          </HuddleText>
          <HuddleText variant="bodyLarge" color="surface" align="center" style={styles.subtitle}>
            Open Huddle on your phone, then scan the QR or enter the room code.
          </HuddleText>
          <View style={styles.phoneIcon} pointerEvents="none" focusable={false} testID="room-invitation-phone-icon">
            <View style={styles.phoneIconSpeaker} pointerEvents="none" focusable={false} />
            <View style={styles.phoneIconHome} pointerEvents="none" focusable={false} />
          </View>
          <HuddleText variant="caption" color="surface" align="center" style={styles.roomCodeLabel}>
            Room Code
          </HuddleText>
          <PlatformRoomCode
            code={normalizedCode}
            spokenCode={spokenCode}
            accessibilityLabel={`Room code ${spokenCode}`}
            testID="room-code-tiles"
          />
          <HuddleText variant="body" color="surface" align="center" style={styles.waitingCopy}>
            Waiting for players to join...
          </HuddleText>
        </View>

        <View style={styles.qrColumn} pointerEvents="none" focusable={false} accessible={false}>
          <PlatformQrFrame
            style={styles.qrFrame}
            pointerEvents="none"
            focusable={false}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`QR code to join room ${spokenCode}`}
          >
            <QRCode
              value={joinUrl}
              size={236}
              color={semanticColors.text}
              backgroundColor={semanticColors.surface}
              testID="room-join-qr"
            />
          </PlatformQrFrame>
          <HuddleText variant="body" color="surface" align="center" style={styles.qrCopy}>
            {'Scan to join on\nyour phone'}
          </HuddleText>
        </View>

        <PlatformRail
          style={styles.rosterRail}
          pointerEvents="none"
          focusable={false}
          accessible={false}
          testID="room-roster-panel"
        >
          <View style={styles.rosterHeader} pointerEvents="none" focusable={false}>
            <View pointerEvents="none" focusable={false}>
              <HuddleText variant="title" color="surface">
                Players in the room
              </HuddleText>
              <HuddleText variant="caption" color="surface" style={styles.rosterHint}>
                Everyone joining appears here
              </HuddleText>
            </View>
            <Badge
              label={`${visiblePlayers.length}/${PLAYER_CAPACITY} joined`}
              tone="neutral"
              testID="room-roster-count"
            />
          </View>
          <View
            style={styles.playerGrid}
            pointerEvents="none"
            focusable={false}
            testID="player-grid"
          >
            {Array.from({ length: PLAYER_CAPACITY }, (_unused, position) => {
              const player = visiblePlayers[position];
              return player ? (
                <JoinedPlayer key={player.id} player={player} />
              ) : (
                <EmptySlot key={`empty-${position + 1}`} position={position} />
              );
            })}
          </View>
        </PlatformRail>
      </PlatformStage>
    </View>
  );
}

function JoinedPlayer({ player }: { readonly player: RoomInvitationPlayer }) {
  const name = player.name.trim() || 'Player';
  const status = player.away ? 'away' : player.host ? 'host' : 'waiting';

  return (
    <View
      style={styles.playerSlot}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Player ${name} joined`}
      testID="joined-player-slot"
    >
      {player.avatar ? (
        <Image
          source={player.avatar}
          resizeMode="contain"
          style={styles.avatarImage}
          accessible={false}
          testID="joined-player-avatar"
        />
      ) : player.avatarId ? (
        <AvatarPortrait
          avatarId={player.avatarId}
          displayName={name}
          size={58}
          testID="joined-player-avatar"
        />
      ) : (
        <View style={styles.avatarFallback} pointerEvents="none" focusable={false}>
          <HuddleText variant="title" color="text" accessibilityElementsHidden>
            {Array.from(name)[0]?.toLocaleUpperCase() ?? '?'}
          </HuddleText>
        </View>
      )}
      <HuddleText variant="caption" color="surface" numberOfLines={1} style={styles.playerName} accessibilityElementsHidden>
        {name}
      </HuddleText>
      {status === 'host' ? <Badge label="Host" tone="host" /> : null}
      {status === 'away' ? <Badge label="Away" tone="away" /> : null}
    </View>
  );
}

function EmptySlot({ position }: { readonly position: number }) {
  return (
    <View
      style={styles.playerSlot}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Empty player slot ${position + 1}`}
      testID="empty-player-slot"
    >
      <View style={styles.emptyCircle} pointerEvents="none" focusable={false} />
      <HuddleText variant="caption" color="surface" style={styles.emptyLabel} accessibilityElementsHidden>
        Open seat
      </HuddleText>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: semanticColors.text,
  },
  brandRow: {
    left: 104,
    top: 68,
  },
  inviteColumn: {
    position: 'absolute',
    left: 218,
    top: 224,
    width: 820,
    alignItems: 'center',
  },
  title: {
    color: semanticColors.surface,
    fontSize: 62,
    lineHeight: 72,
  },
  subtitle: {
    marginTop: spacing.md,
    maxWidth: 780,
    color: semanticColors.surface,
    opacity: 0.82,
  },
  roomCodeLabel: {
    marginTop: spacing.md,
    color: semanticColors.secondary,
    letterSpacing: 2,
    ...typography.caption,
  },
  phoneIcon: {
    width: 24,
    height: 38,
    marginTop: spacing.lg,
    borderWidth: 2,
    borderColor: semanticColors.surface,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    opacity: 0.82,
  },
  phoneIconSpeaker: { width: 7, height: 2, borderRadius: 1, backgroundColor: semanticColors.surface },
  phoneIconHome: { width: 4, height: 4, borderRadius: 2, backgroundColor: semanticColors.surface },
  waitingCopy: {
    marginTop: spacing.lg,
    color: semanticColors.surface,
    opacity: 0.78,
  },
  qrColumn: {
    position: 'absolute',
    right: 220,
    top: 230,
    width: 310,
    alignItems: 'center',
  },
  qrFrame: {
    width: 272,
    height: 272,
  },
  qrCopy: {
    marginTop: spacing.lg,
    color: semanticColors.surface,
    opacity: 0.9,
  },
  rosterRail: {
    position: 'absolute',
    left: 104,
    right: 104,
    bottom: 70,
    minHeight: 248,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(17, 11, 8, 0.58)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(249,241,230,0.24)',
  },
  rosterPanel: {
    position: 'absolute',
    left: 104,
    right: 104,
    bottom: 70,
    minHeight: 248,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(17, 11, 8, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(249,241,230,0.35)',
  },
  rosterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rosterHint: {
    marginTop: 2,
    color: semanticColors.surface,
    opacity: 0.62,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  playerSlot: {
    width: '19%',
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.round,
    backgroundColor: semanticColors.primary,
    borderWidth: 2,
    borderColor: semanticColors.surface,
  },
  avatarImage: { width: 66, height: 66, borderRadius: radii.round },
  playerName: {
    maxWidth: 178,
    color: semanticColors.surface,
    textAlign: 'center',
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.round,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: semanticColors.surface,
    opacity: 0.42,
  },
  emptyLabel: {
    color: semanticColors.surface,
    opacity: 0.56,
  },
});
