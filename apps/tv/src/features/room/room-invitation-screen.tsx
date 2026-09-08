import type { AvatarId } from '@huddle/domain';
import { radii, semanticColors, shadows, spacing, typography } from '@huddle/design-tokens';
import {
  AvatarPortrait,
  Badge,
  HEARTBEAT_ARTWORK,
  HuddleText,
} from '@huddle/ui/native';
import QRCode from 'react-native-qrcode-svg';
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;
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
 * The TV invitation is a passive stage projection. The room photo is the
 * atmosphere; the dark inner frame is the shared screen where the room code,
 * QR and roster live. Keeping these layers separate makes the composition
 * readable at 720p without baking controls or copy into artwork.
 */
export function RoomInvitationScreen({
  roomCode,
  joinUrl,
  players = [],
}: RoomInvitationScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
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
      <View
        style={[styles.stage, { transform: [{ scale }] }]}
        pointerEvents="none"
        focusable={false}
        accessible={false}
        testID="room-invitation-stage"
      >
        <ImageBackground
          source={HEARTBEAT_ARTWORK.tv.platformLivingRoom}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="room-invitation-background"
        />
        <View style={styles.atmosphereShade} pointerEvents="none" focusable={false} />

        <View style={styles.screenFrame} pointerEvents="none" focusable={false}>
          <View style={styles.screenInner} pointerEvents="none" focusable={false}>
            <View style={styles.brandRow} pointerEvents="none" focusable={false} accessible={false}>
              <Image
                source={HEARTBEAT_ARTWORK.brand.displayMark}
                resizeMode="contain"
                style={styles.brandMark}
                accessible={false}
                testID="room-invitation-brand-mark"
              />
              <HuddleText variant="hero" color="surface" style={styles.brandName}>
                Huddle
              </HuddleText>
            </View>

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
              <TvCode
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
              <View
                style={styles.qrCard}
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
              </View>
              <HuddleText variant="body" color="surface" align="center" style={styles.qrCopy}>
                {'Scan to join on\nyour phone'}
              </HuddleText>
            </View>
          </View>
        </View>

        <View
          style={styles.rosterPanel}
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
        </View>
      </View>
    </View>
  );
}

function TvCode({
  code,
  spokenCode,
  accessibilityLabel,
  testID,
}: {
  readonly code: string;
  readonly spokenCode: string;
  readonly accessibilityLabel: string;
  readonly testID: string;
}) {
  return (
    <View
      style={styles.codeRow}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {Array.from({ length: 4 }, (_unused, index) => (
        <View key={`${index}-${code[index] ?? ''}`} style={styles.codeTile} pointerEvents="none" focusable={false}>
          <HuddleText variant="hero" color="text" style={styles.codeValue}>
            {code[index] ?? ''}
          </HuddleText>
        </View>
      ))}
      <HuddleText variant="caption" color="surface" style={styles.visuallyHidden}>
        {spokenCode}
      </HuddleText>
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

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: semanticColors.text,
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  atmosphereShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semanticColors.text,
    opacity: 0.24,
  },
  screenFrame: {
    position: 'absolute',
    left: 122,
    right: 122,
    top: 68,
    bottom: 140,
    borderRadius: radii.xl,
    padding: 14,
    backgroundColor: semanticColors.text,
    borderWidth: 4,
    borderColor: 'rgba(249,241,230,0.30)',
    ...shadows.floating,
  },
  screenInner: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(43,31,23,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(249,241,230,0.35)',
    overflow: 'hidden',
  },
  brandRow: {
    position: 'absolute',
    left: 76,
    top: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandMark: { width: 82, height: 82 },
  brandName: {
    fontSize: 56,
    lineHeight: 68,
    color: semanticColors.surface,
  },
  inviteColumn: {
    position: 'absolute',
    left: 260,
    top: 120,
    width: 780,
    alignItems: 'center',
  },
  title: {
    color: semanticColors.surface,
    fontSize: 62,
    lineHeight: 72,
  },
  subtitle: {
    marginTop: spacing.sm,
    maxWidth: 720,
    color: semanticColors.surface,
    opacity: 0.82,
  },
  roomCodeLabel: {
    marginTop: spacing.sm,
    color: semanticColors.secondary,
    letterSpacing: 2,
    ...typography.caption,
  },
  phoneIcon: {
    width: 24,
    height: 38,
    marginTop: spacing.sm,
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
  codeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  codeTile: {
    width: 92,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: semanticColors.surface,
    borderWidth: 2,
    borderColor: 'rgba(43,31,23,0.18)',
    ...shadows.card,
  },
  codeValue: {
    fontSize: 56,
    lineHeight: 64,
    color: semanticColors.text,
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  waitingCopy: {
    marginTop: spacing.md,
    color: semanticColors.surface,
    opacity: 0.78,
  },
  qrColumn: {
    position: 'absolute',
    right: 90,
    top: 148,
    width: 310,
    alignItems: 'center',
  },
  qrCard: {
    width: 278,
    height: 278,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    backgroundColor: semanticColors.surface,
    ...shadows.floating,
  },
  qrCopy: {
    marginTop: spacing.md,
    color: semanticColors.surface,
    opacity: 0.9,
  },
  rosterPanel: {
    position: 'absolute',
    left: 156,
    right: 156,
    bottom: 156,
    minHeight: 284,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(27, 18, 13, 0.94)',
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
