import type { GameModule, GamePlayer } from '@huddle/domain';
import { playroomColors, playroomTv } from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomHeading,
  PlayroomPill,
  PlayroomStatusImage,
  PlayroomText,
  PlayroomTvStage,
} from '@huddle/ui/native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

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
  const paused = kind === 'paused';
  const waitingForPlayers = paused && reason === 'playerDisconnected';
  const normalizedCode = roomCode.trim().toUpperCase().slice(0, 4);
  const gameTitle = titleForGame(gameId);
  const missing = players.filter((player) => player.away);
  const host = players.find((player) => player.host);
  const message = paused
    ? waitingForPlayers
      ? missing.length === 1
        ? `${missing[0]?.nickname} lost connection. The game continues when they’re back.`
        : `${missing.length} players lost connection. The game continues when they’re back.`
      : 'The TV connection is recovering. Your room is still safe.'
    : 'This game can’t be played right now.';
  const title = paused
    ? waitingForPlayers
      ? 'Waiting for players to reconnect'
      : 'Waiting for the room to reconnect'
    : 'Game unavailable';
  const rosterSummary = waitingForPlayers
    ? players.slice(0, 5).map((player) => `${player.nickname}, ${player.away ? 'reconnecting' : 'connected'}`).join('. ')
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
      <PlayroomTvStage>
        <View style={styles.column} pointerEvents="none" focusable={false} accessible={false}>
          <PlayroomPill textStyle={playroomTv.type.caption}>{paused ? `${gameTitle} · paused` : `Room ${normalizedCode}`}</PlayroomPill>
          <PlayroomHeading type={playroomTv.type.heading}>{paused ? 'Game paused' : 'Game unavailable'}</PlayroomHeading>
          {waitingForPlayers && missing.length > 0 ? (
            // One card per missing player, wrapping onto a second row when a
            // big room drops out, so no name ever runs off the stage.
            <View style={styles.missing} testID="tv-paused-roster">
              {missing.slice(0, 10).map((player) => (
                <View key={String(player.playerId)} style={[styles.player, missing.length > 5 ? styles.playerCompact : null]}>
                  <PlayroomAvatar avatarId={player.avatar} size={missing.length > 5 ? 96 : 140} away />
                  <PlayroomText numberOfLines={1} style={[playroomTv.type.label, styles.center]}>{player.nickname}</PlayroomText>
                  <PlayroomText color="muted" style={[playroomTv.type.caption, styles.center]}>Reconnecting</PlayroomText>
                </View>
              ))}
            </View>
          ) : (
            <PlayroomStatusImage art={paused ? 'paused' : 'disconnected'} width={320} height={320} />
          )}
          <PlayroomText color="muted" style={[playroomTv.type.body, styles.center]}>
            {waitingForPlayers && host && !host.away ? `${message} ${host.nickname} can continue without them.` : message}
          </PlayroomText>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

function StatusBoundary({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}

function titleForGame(gameId: string): string {
  return gameId.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  column: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 200,
  },
  missing: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 36,
    rowGap: 20,
    maxWidth: 1500,
  },
  player: {
    width: 220,
    alignItems: 'center',
    gap: 4,
  },
  playerCompact: {
    width: 200,
  },
  center: {
    textAlign: 'center',
  },
});
