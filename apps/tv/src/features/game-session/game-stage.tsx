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
      ? 'A player lost connection. The game will continue when they return.'
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
          <View style={styles.row}>
            <PlayroomStatusImage art={paused ? 'paused' : 'disconnected'} width={320} height={320} />
            {waitingForPlayers && missing.length > 0 ? (
              <View style={styles.missing} testID="tv-paused-roster">
                {missing.slice(0, 3).map((player) => (
                  <View key={String(player.playerId)} style={styles.player}>
                    <PlayroomAvatar avatarId={player.avatar} size={150} away />
                    <PlayroomText style={playroomTv.type.title}>{`${player.nickname} lost connection`}</PlayroomText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <PlayroomText color="muted" style={[playroomTv.type.body, styles.center]}>
            {waitingForPlayers && host ? `${message} ${host.nickname} can continue without them.` : message}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 60,
  },
  missing: {
    flexDirection: 'row',
    gap: 40,
  },
  player: {
    alignItems: 'center',
    gap: 10,
  },
  center: {
    textAlign: 'center',
  },
});
