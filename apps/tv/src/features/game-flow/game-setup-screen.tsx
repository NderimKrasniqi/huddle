import type { GameSettingsSchema } from '@huddle/domain';
import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';
import {
  AvatarPortrait,
  HEARTBEAT_ARTWORK,
  HuddleText,
} from '@huddle/ui/native';
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { gameArtAsset } from './assets';
import {
  tvHostCopy,
  tvModeLabel,
  tvReadiness,
  visibleTvSetupSettings,
  type TvGamePlayer,
  type TvSetupSettings,
} from './game-flow-model';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export type TvGameSetupScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly mode?: string;
  readonly settings?: TvSetupSettings;
  readonly settingsSchema?: GameSettingsSchema;
  readonly playerRange?: { readonly min: number; readonly max: number };
  readonly players?: readonly TvGamePlayer[];
  readonly readyPlayerIds?: readonly string[];
  readonly stage?: 'configuring' | 'ready';
  readonly reduceMotion?: boolean;
};

/**
 * Display-only setup projection. The phone owns every setting control; the TV
 * gets a single readable setup panel over the selected game's world and a
 * quiet readiness rail for the room.
 */
export function TvGameSetupScreen({
  gameId,
  gameTitle,
  hostName,
  mode,
  settings,
  settingsSchema,
  playerRange,
  players = [],
  readyPlayerIds = [],
  stage = 'configuring',
  reduceMotion = false,
}: TvGameSetupScreenProps) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const title = gameTitle?.trim() || titleForGame(gameId);
  const setupSettings = visibleTvSetupSettings(gameId, settings, settingsSchema);
  const readiness = tvReadiness({ gameId, stage, players, readyPlayerIds, playerRange });
  const art = gameArtAsset(gameId);
  const inRange = playerRange !== undefined && players.length >= playerRange.min && players.length <= playerRange.max;
  const isReadyStage = stage === 'ready';
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(undefined);

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    animationRef.current = Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    });
    animationRef.current.start();
    return () => animationRef.current?.stop();
  }, [enter, gameId, reduceMotion]);

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible={false}
      testID="tv-game-setup"
    >
      <View style={[styles.stage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false} accessible={false}>
        {art ? (
          <ImageBackground source={art} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} testID={`tv-setup-art-${gameId}`} />
        ) : (
          <ImageBackground source={HEARTBEAT_ARTWORK.tv.platformLivingRoom} resizeMode="cover" style={StyleSheet.absoluteFill} accessible={false} testID="tv-setup-fallback-background" />
        )}
        <View style={styles.worldShade} pointerEvents="none" focusable={false} />
        <Animated.View
          style={[
            styles.content,
            {
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
            },
          ]}
          pointerEvents="none"
          focusable={false}
          accessible={false}
        >
          <View style={styles.topBar} pointerEvents="none" focusable={false}>
            <View style={styles.brandLockup} pointerEvents="none" focusable={false}>
              <Image source={HEARTBEAT_ARTWORK.brand.displayMark} resizeMode="contain" style={styles.brandMark} accessible={false} />
              <HuddleText variant="title" color="surface">Huddle</HuddleText>
            </View>
            <View style={styles.topRight} pointerEvents="none" focusable={false}>
              <HuddleText variant="caption" color="surface" style={styles.kicker}>{`${title.toUpperCase()} · SETUP`}</HuddleText>
              <View style={styles.modePill} pointerEvents="none" focusable={false} testID="tv-game-setup-mode">
                <HuddleText variant="caption" color="text">MODE</HuddleText>
                <HuddleText variant="title" color="text">{tvModeLabel(mode)}</HuddleText>
              </View>
            </View>
          </View>

          <View style={styles.setupPanel} pointerEvents="none" focusable={false} accessible={false}>
            <HuddleText variant="caption" color="text" style={styles.visuallyHidden}>{`${title} setup`}</HuddleText>
            {!isReadyStage ? <HuddleText variant="caption" color="text" style={styles.visuallyHidden}>Setup is being finalized</HuddleText> : null}
            <HuddleText variant="caption" color="text" style={styles.panelKicker}>{isReadyStage ? 'READY TO PLAY' : 'HOST SETUP'}</HuddleText>
            <HuddleText variant="tvDisplay" color="text" style={styles.title}>
              {isReadyStage ? `${title} is ready` : `Set up ${title}`}
            </HuddleText>
            <HuddleText variant="bodyLarge" color="text" style={styles.subtitle}>
              {isReadyStage
                ? tvHostCopy(hostName, 'is choosing when to start on the phone.')
                : tvHostCopy(hostName, 'is finalizing settings on the phone.')}
            </HuddleText>

            <View style={styles.divider} pointerEvents="none" focusable={false} />
            <HuddleText variant="title" color="text" style={styles.sectionLabel}>Game settings</HuddleText>
            <View style={styles.settingsRow} pointerEvents="none" focusable={false} testID="tv-game-setup-settings">
              {setupSettings.length === 0 ? (
                <HuddleText variant="body" color="text" style={styles.noSettings}>This game has no extra settings.</HuddleText>
              ) : setupSettings.map((setting) => (
                <View key={setting.key} style={styles.setting} pointerEvents="none" focusable={false} testID={`tv-game-setting-${setting.key}`}>
                  <HuddleText variant="caption" color="text" style={styles.settingLabel}>{setting.label ?? setting.key}</HuddleText>
                  <HuddleText variant="title" color="text">{setting.value}</HuddleText>
                </View>
              ))}
            </View>

            <View style={styles.panelNotice} pointerEvents="none" focusable={false}>
              <View style={[styles.noticeDot, isReadyStage && readiness.allReady ? styles.noticeReady : null]} pointerEvents="none" focusable={false} />
              <HuddleText variant="body" color="text">
                {isReadyStage
                  ? readiness.allReady
                    ? `Everyone is ready · waiting for ${hostName?.trim() || 'the host'} to start.`
                    : inRange
                      ? `${readiness.readyCount} of ${readiness.playerCount} players are ready.`
                      : playerRange
                        ? `Need ${playerRange.min}–${playerRange.max} players to start.`
                        : 'Waiting for the host to finish setting up.'
                  : 'The room will ready up on the phones when setup is locked.'}
              </HuddleText>
            </View>
          </View>

          <View style={styles.readinessRail} pointerEvents="none" focusable={false} testID="tv-game-setup-readiness">
            <View style={styles.readinessCopy} pointerEvents="none" focusable={false}>
              <HuddleText variant="title" color="surface">
                {isReadyStage
                  ? readiness.allReady
                    ? 'Everyone is ready!'
                    : `${readiness.readyCount} of ${readiness.playerCount} players are ready`
                  : 'Players in the room'}
              </HuddleText>
              <HuddleText variant="body" color="surface" style={styles.readinessSubtitle}>
                {isReadyStage
                  ? readiness.allReady
                    ? 'The game starts when the Host taps Start.'
                    : 'Keep your phone close while the Host finishes setup.'
                  : 'Ready status appears here once the Host locks the setup.'}
              </HuddleText>
            </View>
            <View style={styles.players} pointerEvents="none" focusable={false} testID="tv-game-setup-players">
              {players.slice(0, 10).map((player) => (
                <PlayerChip key={player.id} player={player} readyPlayerIds={readyPlayerIds} stage={stage} />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function PlayerChip({
  player,
  readyPlayerIds,
  stage,
}: {
  readonly player: TvGamePlayer;
  readonly readyPlayerIds: readonly string[];
  readonly stage: 'configuring' | 'ready';
}) {
  const readyStage = stage === 'ready';
  const ready = readyStage && player.away !== true && readyPlayerIds.map(String).includes(String(player.id));
  const name = player.name.trim() || 'Player';
  const status = player.away ? 'away' : ready ? 'ready' : 'waiting';
  const statusLabel = player.away ? 'away' : readyStage ? ready ? 'ready' : 'not ready' : 'in room';

  return (
    <View
      accessible
      focusable={false}
      accessibilityRole="text"
      accessibilityLabel={`${name}${player.isHost ? ', host' : ''}, ${statusLabel}`}
      style={styles.playerChip}
      pointerEvents="none"
      testID={`tv-game-player-${player.id}`}
    >
      {player.avatar ? (
        <Image source={player.avatar} resizeMode="contain" style={styles.avatarImage} accessible={false} testID={`tv-game-player-avatar-${player.id}`} />
      ) : player.avatarId ? (
        <AvatarPortrait avatarId={player.avatarId} displayName={name} size={52} testID={`tv-game-player-avatar-${player.id}`} />
      ) : (
        <View style={styles.avatarFallback} pointerEvents="none" focusable={false}>
          <HuddleText variant="title" color="text" accessibilityElementsHidden>{Array.from(name)[0]?.toLocaleUpperCase() ?? '?'}</HuddleText>
        </View>
      )}
      <View style={styles.playerIdentity} pointerEvents="none" focusable={false}>
        <HuddleText variant="body" color="surface" numberOfLines={1}>{name}</HuddleText>
        <HuddleText variant="caption" color="surface" style={styles.playerStatus} numberOfLines={1}>
          {player.isHost ? 'Host · ' : ''}{status === 'ready' ? 'Ready' : status === 'away' ? 'Away' : status === 'waiting' ? readyStage ? 'Waiting' : 'In room' : 'Ready'}
        </HuddleText>
        {!readyStage && !player.away ? <HuddleText variant="caption" color="surface" style={styles.visuallyHidden}>In room</HuddleText> : null}
      </View>
      <View style={[styles.statusDot, status === 'ready' ? styles.readyDot : status === 'away' ? styles.awayDot : null]} pointerEvents="none" focusable={false} />
    </View>
  );
}

function titleForGame(gameId: string): string {
  if (gameId === 'trivia') return 'Trivia';
  if (gameId === 'voting') return 'Voting';
  return gameId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: semanticColors.text },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden' },
  worldShade: { ...StyleSheet.absoluteFill, backgroundColor: semanticColors.text, opacity: 0.24 },
  content: { position: 'absolute', left: 96, right: 96, top: 54, bottom: 54 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandMark: { width: 56, height: 56 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  kicker: { color: semanticColors.surface, letterSpacing: 2.4 },
  modePill: { minWidth: 170, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: semanticColors.secondary, alignItems: 'center', gap: 2, ...shadows.card },
  setupPanel: { position: 'absolute', left: 0, top: 118, width: 700, minHeight: 570, paddingHorizontal: spacing['2xl'], paddingVertical: spacing['2xl'], borderRadius: radii.xl, backgroundColor: 'rgba(249, 241, 230, 0.97)', ...shadows.floating },
  visuallyHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  panelKicker: { color: semanticColors.text, letterSpacing: 2.1 },
  title: { marginTop: spacing.sm, color: semanticColors.text, fontSize: 58, lineHeight: 66 },
  subtitle: { marginTop: spacing.sm, color: semanticColors.text, opacity: 0.72 },
  divider: { height: 1, marginVertical: spacing.xl, backgroundColor: 'rgba(43,31,23,0.18)' },
  sectionLabel: { color: semanticColors.text, fontSize: 22, lineHeight: 28 },
  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  setting: { minWidth: 180, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.48)', borderWidth: 1, borderColor: 'rgba(43,31,23,0.18)', gap: spacing.xs },
  settingLabel: { color: semanticColors.text, opacity: 0.66 },
  noSettings: { color: semanticColors.text, opacity: 0.68 },
  panelNotice: { marginTop: spacing.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radii.lg, backgroundColor: 'rgba(255,215,102,0.18)', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  noticeDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: semanticColors.secondary },
  noticeReady: { backgroundColor: semanticColors.success },
  readinessRail: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 184, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: radii.xl, backgroundColor: 'rgba(43, 31, 23, 0.92)', borderWidth: 1, borderColor: 'rgba(249,241,230,0.32)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readinessCopy: { flex: 1, paddingRight: spacing.xl },
  readinessSubtitle: { marginTop: spacing.xs, color: semanticColors.surface, opacity: 0.7 },
  players: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, maxWidth: 1050 },
  playerChip: { width: 180, minHeight: 70, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.lg, backgroundColor: 'rgba(249, 241, 230, 0.12)', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: semanticColors.primary },
  playerIdentity: { flex: 1, minWidth: 0 },
  playerStatus: { marginTop: 1, color: semanticColors.surface, opacity: 0.66 },
  statusDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(249,241,230,0.62)' },
  readyDot: { backgroundColor: semanticColors.success },
  awayDot: { backgroundColor: semanticColors.highlight },
});
