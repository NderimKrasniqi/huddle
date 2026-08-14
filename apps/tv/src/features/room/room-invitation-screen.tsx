import {
  Image,
  ImageBackground,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;
const PLAYER_CAPACITY = 10;

const COLORS = {
  letterbox: '#000000',
  ink: '#082B68',
  dashed: '#8797B6',
  qrSurface: '#FFF9F2',
  avatar: '#FF765D',
  avatarText: '#FFFFFF',
} as const;

export type RoomInvitationPlayer = {
  readonly id: string;
  readonly name: string;
  readonly avatar?: ImageSourcePropType;
};

export type RoomInvitationScreenProps = {
  readonly roomCode: string;
  readonly joinUrl: string;
  readonly players?: readonly RoomInvitationPlayer[];
};

/** The app-owned illustrated TV lobby. It is display-only and has no focus targets. */
export function RoomInvitationScreen({
  roomCode,
  joinUrl,
  players = [],
}: RoomInvitationScreenProps) {
  const viewport = useWindowDimensions();
  const scale = Math.min(
    viewport.width / STAGE_WIDTH,
    viewport.height / STAGE_HEIGHT,
  );
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const visiblePlayers = players.slice(0, PLAYER_CAPACITY);
  const slots = Array.from({ length: PLAYER_CAPACITY }, (_unused, position) =>
    visiblePlayers[position] === undefined
      ? ({ kind: 'empty', position } as const)
      : ({ kind: 'player', player: visiblePlayers[position] } as const),
  );
  const spokenCode = roomCode.split('').join(' ');

  return (
    <View style={styles.viewport} testID="room-invitation-viewport">
      <View
        style={[styles.stage, { transform: [{ scale: safeScale }] }]}
        testID="room-invitation-stage"
      >
        <ImageBackground
          source={require('../../../assets/room-invitation/tv-lobby-background.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID="room-invitation-background"
        />

        <View style={styles.codeColumn}>
          <Text style={styles.roomCodeTitle}>Room Code</Text>
          <View
            style={styles.codePanel}
            accessible
            focusable={false}
            accessibilityLabel={`Room code ${spokenCode}`}
            testID="room-code-panel"
          >
            <Text style={styles.roomCode} accessibilityElementsHidden>
              {spokenCode}
            </Text>
          </View>

          <Text style={styles.waitingCopy}>Waiting for players to join...</Text>

          <View style={styles.playerGrid} testID="player-grid">
            {slots.map((slot) =>
              slot.kind === 'player' ? (
                <JoinedPlayer key={slot.player.id} player={slot.player} />
              ) : (
                <EmptySlot
                  key={`empty-${slot.position + 1}`}
                  position={slot.position}
                />
              ),
            )}
          </View>
        </View>

        <View style={styles.joinPanel}>
          <View style={styles.qrCard}>
            <View
              accessible
              focusable={false}
              accessibilityLabel={`QR code to join room ${spokenCode}`}
            >
              <QRCode
                value={joinUrl}
                size={106}
                color={COLORS.ink}
                backgroundColor={COLORS.qrSurface}
                testID="room-join-qr"
              />
            </View>
          </View>

          <View style={styles.scanInstruction}>
            <Image
              source={require('../../../assets/room-invitation/tv-lobby-phone-icon.png')}
              resizeMode="contain"
              style={styles.phoneIcon}
              accessible={false}
              testID="room-invitation-phone-icon"
            />
            <Text style={styles.scanCopy}>{'Scan to join on\nyour phone'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function JoinedPlayer({ player }: { readonly player: RoomInvitationPlayer }) {
  const name = player.name.trim();
  const initial = Array.from(name)[0]?.toLocaleUpperCase() ?? '?';

  return (
    <View
      style={styles.playerSlot}
      accessible
      focusable={false}
      accessibilityLabel={`Player ${name || 'unnamed'} joined`}
      testID="joined-player-slot"
    >
      <View style={[styles.playerCircle, styles.joinedCircle]}>
        {player.avatar === undefined ? (
          <Text style={styles.playerInitial} accessibilityElementsHidden>
            {initial}
          </Text>
        ) : (
          <Image
            source={player.avatar}
            resizeMode="cover"
            style={styles.playerAvatar}
            accessible={false}
            testID="joined-player-avatar"
          />
        )}
      </View>
      <Text
        style={styles.playerName}
        numberOfLines={1}
        accessibilityElementsHidden
      >
        {name}
      </Text>
    </View>
  );
}

function EmptySlot({ position }: { readonly position: number }) {
  return (
    <View
      style={styles.playerSlot}
      accessible
      focusable={false}
      accessibilityLabel={`Empty player slot ${position + 1}`}
      testID="empty-player-slot"
    >
      <View style={[styles.playerCircle, styles.emptyCircle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.letterbox,
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  codeColumn: {
    position: 'absolute',
    top: 104,
    left: 404,
    width: 493,
    alignItems: 'center',
  },
  roomCodeTitle: {
    color: COLORS.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  codePanel: {
    width: 390,
    height: 121,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: COLORS.dashed,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 40,
  },
  roomCode: {
    color: COLORS.ink,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
  },
  waitingCopy: {
    marginTop: 24,
    color: COLORS.ink,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  playerGrid: {
    width: 550,
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 40,
    columnGap: 40,
  },
  playerSlot: {
    width: 70,
    height: 64,
    alignItems: 'center',
  },
  playerCircle: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
  },
  emptyCircle: {
    borderColor: COLORS.dashed,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  joinedCircle: {
    overflow: 'hidden',
    backgroundColor: COLORS.avatar,
    borderColor: COLORS.qrSurface,
    borderWidth: 3,
  },
  playerInitial: {
    color: COLORS.avatarText,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  playerAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  playerName: {
    maxWidth: 92,
    marginTop: 3,
    color: COLORS.ink,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  joinPanel: {
    position: 'absolute',
    top: 140,
    left: 873,
    width: 160,
    alignItems: 'center',
  },
  qrCard: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.qrSurface,
    borderRadius: 15,
    shadowColor: '#6B3B22',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  scanInstruction: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneIcon: {
    width: 56,
    height: 52,
  },
  scanCopy: {
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
  },
});
