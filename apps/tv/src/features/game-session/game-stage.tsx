import type { GameModule, GamePlayer } from '@huddle/domain';
import { AvatarPortrait, HEARTBEAT_ARTWORK, HuddleText } from '@huddle/ui/native';
import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View, useWindowDimensions } from 'react-native';
import { radii, semanticColors, shadows, spacing } from '@huddle/design-tokens';

import type { RosterSeat } from '../../models';

/** Generic TV runtime mount; the hub never branches on a game id here. */
export function GameStage({
  module,
  state,
  players,
  clockRemainingMs,
}: {
  readonly module: GameModule;
  readonly state: unknown;
  readonly players: readonly GamePlayer[];
  readonly clockRemainingMs?: number;
}) {
  return (
    <StatusBoundary>
      {module.screens.tv({ state, players, clockRemainingMs })}
    </StatusBoundary>
  );
}

export function TvRuntimeStatus({
  kind,
  reason,
  gameId,
  roomCode,
  players,
}: {
  readonly kind: 'paused' | 'unavailable';
  readonly reason?: 'tvDisconnected' | 'playerDisconnected';
  readonly gameId: string;
  readonly roomCode: string;
  readonly players: readonly RosterSeat[];
}) {
  const viewport = useWindowDimensions();
  const scale = safeScale(viewport.width, viewport.height);
  const paused = kind === 'paused';
  const waitingForPlayers = paused && reason === 'playerDisconnected';
  const normalizedCode = roomCode.trim().toUpperCase().slice(0, 4);
  const gameTitle = titleForGame(gameId);
  const visiblePlayers = players.slice(0, 5);
  const background = paused
    ? gameId === 'trivia'
      ? HEARTBEAT_ARTWORK.gameWorlds.trivia
      : gameId === 'voting'
        ? HEARTBEAT_ARTWORK.gameWorlds.voting
        : HEARTBEAT_ARTWORK.tv.platformLivingRoom
    : HEARTBEAT_ARTWORK.tv.platformLivingRoom;
  const message = paused
    ? waitingForPlayers
      ? 'A player lost connection. The game will continue when they return.'
      : 'The TV connection is recovering. Your room is still safe.'
    : 'This game can’t be played right now.';
  const title = paused
    ? waitingForPlayers
      ? 'Waiting for players to reconnect'
      : 'Waiting for the room to reconnect'
    : 'Game unavailable';
  const rosterSummary = waitingForPlayers
    ? visiblePlayers.map((player) => `${player.nickname}, ${player.away ? 'reconnecting' : 'connected'}`).join('. ')
    : '';

  return (
    <View
      style={styles.viewport}
      pointerEvents="none"
      focusable={false}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${paused ? `Game paused. ${title}. ${message}${rosterSummary ? ` ${rosterSummary}.` : ''}` : `Game unavailable. ${message} Room code ${normalizedCode.split('').join(' ')}.`}`}
      testID={`tv-runtime-${kind}`}
    >
      <View style={[styles.stage, { transform: [{ scale }] }]} pointerEvents="none" focusable={false}>
        <ImageBackground
          source={background}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
          testID={`tv-runtime-${kind}-background`}
        />
        <View style={[styles.stageShade, paused ? styles.pausedShade : styles.unavailableShade]} pointerEvents="none" focusable={false} />
        {paused ? (
          <>
            <View style={styles.pausedCopy} pointerEvents="none" focusable={false} accessible={false}>
              <HuddleText variant="bodyLarge" color="surface" style={styles.eyebrow}>Game paused</HuddleText>
              <HuddleText variant="tvDisplay" color="surface" style={styles.pausedTitle}>{title}</HuddleText>
              <HuddleText variant="bodyLarge" color="surface" style={styles.pausedMessage}>{message}</HuddleText>
              <View style={styles.gamePill} pointerEvents="none" focusable={false}>
                <HuddleText variant="title" color="text">{gameTitle}</HuddleText>
              </View>
            </View>
            {waitingForPlayers && visiblePlayers.length > 0 ? (
              <View style={styles.rosterPanel} pointerEvents="none" focusable={false} accessible={false} testID="tv-paused-roster">
                {visiblePlayers.map((player) => (
                  <View key={String(player.playerId)} style={styles.playerRow} pointerEvents="none" focusable={false}>
                    <AvatarPortrait avatarId={player.avatar} displayName={player.nickname} size={52} disabled={player.away} />
                    <View style={styles.playerCopy} pointerEvents="none" focusable={false}>
                      <HuddleText variant="bodyLarge" color="text" numberOfLines={1}>{player.nickname}</HuddleText>
                      <View style={styles.playerStatus} pointerEvents="none" focusable={false}>
                        <View style={[styles.statusDot, player.away ? styles.awayDot : null]} />
                        <HuddleText variant="caption" color="text">{player.away ? 'Reconnecting…' : 'Connected'}</HuddleText>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.unavailableContent} pointerEvents="none" focusable={false} accessible={false}>
            <HuddleText variant="tvDisplay" color="surface" align="center" style={styles.unavailableTitle}>Game unavailable</HuddleText>
            <HuddleText variant="bodyLarge" color="surface" align="center" style={styles.unavailableMessage}>{message}</HuddleText>
            <HuddleText variant="caption" color="surface" align="center" style={styles.roomLabel}>ROOM CODE</HuddleText>
            <View style={styles.codeRow} pointerEvents="none" focusable={false}>
              {Array.from({ length: 4 }, (_unused, index) => (
                <View key={`${index}-${normalizedCode[index] ?? ''}`} style={styles.codeTile} pointerEvents="none" focusable={false}>
                  <HuddleText variant="hero" color="surface">{normalizedCode[index] ?? ''}</HuddleText>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function StatusBoundary({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}

function safeScale(width: number, height: number): number {
  const scale = Math.min(width / 1920, height / 1080);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function titleForGame(gameId: string): string {
  return gameId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: semanticColors.text },
  stage: { width: 1920, height: 1080, overflow: 'hidden' },
  stageShade: { ...StyleSheet.absoluteFill, backgroundColor: semanticColors.text },
  pausedShade: { opacity: 0.36 },
  unavailableShade: { opacity: 0.7 },
  pausedCopy: { position: 'absolute', left: 160, top: 190, width: 880, bottom: 100, justifyContent: 'center', alignItems: 'flex-start' },
  eyebrow: { color: semanticColors.surface, opacity: 0.9 },
  pausedTitle: { marginTop: spacing.sm, maxWidth: 860, color: semanticColors.surface, textShadowColor: semanticColors.text, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  pausedMessage: { marginTop: spacing.lg, maxWidth: 720, color: semanticColors.surface, opacity: 0.9 },
  gamePill: { marginTop: spacing['2xl'], paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: semanticColors.secondary, ...shadows.card },
  rosterPanel: { position: 'absolute', right: 140, top: 210, width: 440, padding: spacing.lg, gap: spacing.sm, borderRadius: radii.xl, backgroundColor: 'rgba(249, 241, 230, 0.94)', ...shadows.floating },
  playerRow: { minHeight: 76, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, backgroundColor: 'rgba(255, 255, 255, 0.62)' },
  playerCopy: { flex: 1, gap: spacing.xs },
  playerStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 12, height: 12, borderRadius: radii.round, backgroundColor: semanticColors.success },
  awayDot: { backgroundColor: semanticColors.secondary },
  unavailableContent: { position: 'absolute', left: 360, right: 360, top: 170, bottom: 120, alignItems: 'center', justifyContent: 'center' },
  unavailableTitle: { color: semanticColors.surface, textShadowColor: semanticColors.text, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 },
  unavailableMessage: { marginTop: spacing.md, color: semanticColors.surface, opacity: 0.9 },
  roomLabel: { marginTop: spacing['3xl'], color: semanticColors.surface, letterSpacing: 3, opacity: 0.82 },
  codeRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  codeTile: { width: 92, height: 104, alignItems: 'center', justifyContent: 'center', borderRadius: radii.lg, backgroundColor: 'rgba(249, 241, 230, 0.22)', borderWidth: 2, borderColor: 'rgba(249, 241, 230, 0.58)' },
});
