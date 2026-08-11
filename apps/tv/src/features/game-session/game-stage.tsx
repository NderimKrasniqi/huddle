import { gamePlayersFrom, type GameModule } from '@huddle/game-core';
import { Text, View } from 'react-native';

import { TvHeader, TvStage } from '../../ui/native';
import type { RosterSeat } from '../../models';
import { styles } from './styles';

export function GameStage({
  module,
  state,
  clockRemainingMs,
  roster,
}: {
  readonly module: GameModule;
  readonly state: unknown;
  readonly clockRemainingMs?: number;
  readonly roster: readonly RosterSeat[];
}) {
  // Mounted as a component rather than called as a function, so a game's screen
  // owns its own hooks instead of registering them on this one's list.
  const TvScreen = module.screens.tv;

  return (
    <TvStage>
      <View style={styles.screen}>
        <TvHeader trailing={<Text style={styles.gameTitle}>{module.metadata.title}</Text>} />

        <View style={styles.gameStage}>
          <TvScreen
            state={state}
            players={gamePlayersFrom(roster)}
            clockRemainingMs={clockRemainingMs}
          />
        </View>
      </View>
    </TvStage>
  );
}

/** No game controls are mounted while the shared TV is paused or unavailable. */
export function TvRuntimeStatus({
  kind,
  reason,
  disconnectedPlayers,
}: {
  readonly kind: 'paused' | 'unavailable';
  readonly reason?: 'tvDisconnected' | 'playerDisconnected';
  readonly disconnectedPlayers: readonly string[];
}) {
  const playerDisconnected = kind === 'paused' && reason === 'playerDisconnected';
  const disconnected =
    disconnectedPlayers.length === 1
      ? `${disconnectedPlayers[0]} disconnected`
      : disconnectedPlayers.length > 1
        ? `${disconnectedPlayers.length} players disconnected`
        : 'A player disconnected';
  const title = playerDisconnected
    ? disconnected
    : kind === 'paused'
      ? 'TV disconnected'
      : 'Game unavailable';
  const message = playerDisconnected
    ? 'Game paused — the Host can wait or continue without them.'
    : kind === 'paused'
      ? 'Reconnecting — the game is paused.'
      : 'Return to the lobby from the Host phone to continue.';

  return (
    <TvStage>
      <View style={styles.runtimeStatus}>
        <TvHeader />
        <Text style={styles.gameTitle}>{title}</Text>
        <Text style={styles.runtimeStatusText}>{message}</Text>
      </View>
    </TvStage>
  );
}
