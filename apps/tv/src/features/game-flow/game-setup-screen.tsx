import type { GameSettingsSchema } from '@huddle/domain';
import {
  Animated,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { TV_GAME_FLOW_ASSETS, gameArtAsset } from './assets';
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

/** The generic TV setup shell draws only module-projected settings and roster state. */
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
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const animationRef = useRef<Animated.CompositeAnimation | undefined>(undefined);

  useEffect(() => {
    animationRef.current?.stop();
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }

    enter.setValue(0);
    animationRef.current = Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 145,
      mass: 0.82,
    });
    animationRef.current.start();
    return () => animationRef.current?.stop();
  }, [enter, gameId, reduceMotion]);

  return (
    <View style={styles.viewport} pointerEvents="none" testID="tv-game-setup">
      <View style={[styles.stage, { transform: [{ scale }] }]} accessible focusable={false}>
        {art ? (
          <ImageBackground
            source={art}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            accessible={false}
            testID={`tv-setup-art-${gameId}`}
          />
        ) : (
          <ImageBackground
            source={TV_GAME_FLOW_ASSETS.background}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
            accessible={false}
            testID="tv-setup-fallback-background"
          />
        )}
        {gameId === 'voting' ? <View style={styles.votingBadgeMask} testID="tv-setup-voting-art-badge-mask" /> : null}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.eyebrow}>{title.toUpperCase()} • SETUP</Text>
          <Text style={styles.title}>{title} is getting ready</Text>
          <Text style={styles.subtitle}>{tvHostCopy(hostName, 'is choosing settings on the phone.')}</Text>

          <View style={styles.modePill} testID="tv-game-setup-mode">
            <Text style={styles.modeLabel}>MODE</Text>
            <Text style={styles.modeValue}>{tvModeLabel(mode)}</Text>
          </View>

          <View style={styles.settingsRow} testID="tv-game-setup-settings">
            {setupSettings.length === 0 ? (
              <View style={styles.emptySettings}>
                <Text style={styles.emptySettingsText}>Settings are being prepared on the phone.</Text>
              </View>
            ) : (
              setupSettings.map((setting) => (
                <View key={setting.key} style={styles.settingCard} testID={`tv-game-setting-${setting.key}`}>
                  {iconForSetting(setting.key) ? (
                    <Image
                      source={iconForSetting(setting.key)}
                      resizeMode="contain"
                      style={styles.settingIcon}
                      accessible={false}
                    />
                  ) : (
                    <View style={styles.genericSettingIcon} accessible={false} />
                  )}
                  <View style={styles.settingCopy}>
                    <Text style={styles.settingLabel}>{setting.label}</Text>
                    <Text style={styles.settingValue}>{setting.value}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.readiness} testID="tv-game-setup-readiness">
            <View style={styles.readinessCopy}>
              <Text style={styles.readinessTitle}>
                {readiness.allReady ? 'Everyone is ready!' : `${readiness.readyCount} of ${readiness.playerCount} players are ready`}
              </Text>
              <Text style={styles.readinessSubtitle}>
                {readiness.allReady ? `Waiting for ${hostName?.trim() || 'the host'} to start.` : 'Waiting for everyone to get ready…'}
              </Text>
            </View>
            <View style={styles.players} testID="tv-game-setup-players">
              {players.slice(0, 10).map((player) => <PlayerChip key={player.id} player={player} readyPlayerIds={readyPlayerIds} />)}
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
}: {
  readonly player: TvGamePlayer;
  readonly readyPlayerIds: readonly string[];
}) {
  const ready = player.away !== true && readyPlayerIds.map(String).includes(String(player.id));
  const name = player.name.trim() || 'Player';
  const initial = Array.from(name)[0]?.toLocaleUpperCase() ?? '?';

  return (
    <View
      accessible
      focusable={false}
      accessibilityLabel={`${name}${player.isHost ? ', host' : ''}${player.away ? ', away' : ''}${ready ? ', ready' : ', not ready'}`}
      style={styles.playerChip}
      testID={`tv-game-player-${player.id}`}
    >
      <View style={[styles.avatar, { borderColor: player.away ? '#FFB24B' : ready ? '#5ED583' : 'rgba(255,255,255,0.45)' }]}>
        {player.avatar ? (
          <Image source={player.avatar} resizeMode="cover" style={styles.avatarImage} accessible={false} />
        ) : (
          <Text style={[styles.initial, { color: player.isHost ? '#FFB24B' : '#FFFFFF' }]} accessibilityElementsHidden>{initial}</Text>
        )}
      </View>
      <Text style={styles.playerName} numberOfLines={1} accessibilityElementsHidden>{name}</Text>
      {player.away ? <Text style={styles.awayLabel}>Away</Text> : null}
    </View>
  );
}

function iconForSetting(key: string) {
  if (key === 'rounds') return TV_GAME_FLOW_ASSETS.setupIcons.rounds;
  if (key === 'questions') return TV_GAME_FLOW_ASSETS.setupIcons.questions;
  return undefined;
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
  viewport: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#110A2F',
  },
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden' },
  scrim: { backgroundColor: 'rgba(14,8,47,0.61)' },
  votingBadgeMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 954,
    height: 126,
    backgroundColor: 'rgba(54,25,98,0.96)',
  },
  content: { flex: 1, paddingHorizontal: 116, paddingTop: 72, paddingBottom: 66 },
  eyebrow: { color: '#A57BFF', fontSize: 18, fontWeight: '900', letterSpacing: 2.4 },
  title: { color: '#FFF9F4', fontSize: 58, fontWeight: '900', letterSpacing: -1.6, marginTop: 5 },
  subtitle: { color: 'rgba(255,249,244,0.82)', fontSize: 21, fontWeight: '600', marginTop: 7 },
  modePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(165,123,255,0.2)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
  },
  modeLabel: { color: 'rgba(255,249,244,0.72)', fontSize: 14, fontWeight: '800', letterSpacing: 1.2 },
  modeValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginLeft: 10 },
  settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, width: '78%', marginTop: 34 },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48.5%',
    minHeight: 144,
    padding: 22,
    borderRadius: 28,
    backgroundColor: 'rgba(20,12,60,0.76)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
  },
  settingIcon: { width: 56, height: 56 },
  genericSettingIcon: {
    width: 18,
    height: 18,
    marginHorizontal: 19,
    borderRadius: 999,
    backgroundColor: '#A57BFF',
  },
  settingCopy: { flex: 1, marginLeft: 18 },
  settingLabel: { color: 'rgba(255,249,244,0.74)', fontSize: 18, fontWeight: '700' },
  settingValue: { color: '#FFF9F4', fontSize: 32, fontWeight: '900', marginTop: 3 },
  emptySettings: { padding: 26, borderRadius: 28, backgroundColor: 'rgba(20,12,60,0.76)' },
  emptySettingsText: { color: '#FFF9F4', fontSize: 22, fontWeight: '700' },
  readiness: {
    marginTop: 'auto',
    minHeight: 104,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 34,
    backgroundColor: 'rgba(12,10,37,0.8)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readinessCopy: { flexShrink: 1 },
  readinessTitle: { color: '#FFF9F4', fontSize: 25, fontWeight: '900' },
  readinessSubtitle: { color: 'rgba(255,249,244,0.74)', fontSize: 18, fontWeight: '600', marginTop: 4 },
  players: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 24 },
  playerChip: { alignItems: 'center', maxWidth: 74 },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarImage: { width: '100%', height: '100%' },
  initial: { fontSize: 21, fontWeight: '900' },
  playerName: { color: '#FFF9F4', fontSize: 14, fontWeight: '700', marginTop: 4, maxWidth: 74 },
  awayLabel: { color: '#FFB24B', fontSize: 11, fontWeight: '800', marginTop: 2 },
});
