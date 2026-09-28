import { settingSummaryText } from '@huddle/domain';
import { playroomColors, playroomEasing, playroomMotion, playroomRadii, playroomTv } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomHeading, PlayroomPill, PlayroomText, PlayroomTvStage } from '@huddle/ui/native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { tvHostCopy, tvReadiness, type TvGamePlayer } from './game-flow-model';
import type { TvGameSetupScreenProps } from './game-setup-screen';
import { TvPlayroomFrame } from './playroom-frame';

/** How far a player lifts when they raise their hand. */
const LIFT = playroomMotion.entranceTravel;

/**
 * The ready check: everyone raises a hand on their phone. A ready player's
 * avatar lifts with an orange hand, and a bar fills one segment per player.
 */
export function TvReadyCheckScreen({
  gameId,
  gameTitle,
  hostName,
  settings,
  settingsSchema,
  playerRange,
  players = [],
  readyPlayerIds = [],
  stage = 'ready',
  reduceMotion = false,
}: TvGameSetupScreenProps) {
  const title = gameTitle?.trim() || (gameId === 'trivia' ? 'Trivia' : gameId === 'voting' ? 'Voting' : 'Game');
  const { readyCount, playerCount, allReady } = tvReadiness({ gameId, stage, players, readyPlayerIds, playerRange });
  const isReady = (player: TvGamePlayer) => player.away !== true && readyPlayerIds.includes(player.id);
  const waiting = players.filter((player) => !isReady(player)).map((player) => player.name);
  const values = settings === undefined || Array.isArray(settings) ? {} : (settings as Readonly<Record<string, string>>);
  const summary = (settingsSchema ?? []).map((setting) => settingSummaryText(setting, values[setting.key]));

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="tv-game-setup">
      <PlayroomTvStage>
        <TvPlayroomFrame reduceMotion={reduceMotion} />
        <View style={styles.column} pointerEvents="none" focusable={false}>
          <PlayroomHeading type={playroomTv.type.heading}>{`Hands up for ${title}!`}</PlayroomHeading>
          {summary.length > 0 ? (
            <PlayroomPill textStyle={playroomTv.type.caption} testID="tv-game-setup-settings">
              {[title, ...summary].join(' · ')}
            </PlayroomPill>
          ) : null}
          <View style={styles.grid}>
            {players.map((player) => (
              <Seat key={player.id} player={player} ready={isReady(player)} reduceMotion={reduceMotion} />
            ))}
          </View>
          <View style={styles.bar} accessible accessibilityLabel={`${readyCount} of ${playerCount} players are ready`}>
            <View style={styles.segments}>
              {players.map((player, position) => (
                <View key={player.id} style={[styles.segment, position < readyCount ? styles.segmentOn : null]} />
              ))}
            </View>
            <PlayroomText style={playroomTv.type.title}>
              {allReady ? 'Every hand is up!' : `${readyCount} of ${playerCount} hands up`}
            </PlayroomText>
            <PlayroomText color="muted" style={playroomTv.type.body}>
              {allReady ? tvHostCopy(hostName, 'can start the game') : `Waiting for ${listNames(waiting)}`}
            </PlayroomText>
          </View>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

function Seat({
  player,
  ready,
  reduceMotion,
}: {
  readonly player: TvGamePlayer;
  readonly ready: boolean;
  readonly reduceMotion: boolean;
}) {
  const lift = useSharedValue(ready ? -LIFT : 0);
  useEffect(() => {
    const to = ready ? -LIFT : 0;
    lift.set(reduceMotion ? to : withTiming(to, { duration: playroomMotion.entrance, easing: Easing.bezier(...playroomEasing.out) }));
  }, [lift, ready, reduceMotion]);
  const lifted = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));

  return (
    <Animated.View
      style={[styles.seat, lifted]}
      accessible
      accessibilityLabel={`${player.name}${player.isHost ? ', host' : ''}${player.away ? ', away' : ready ? ', ready' : ''}`}
    >
      {player.avatarId ? (
        <PlayroomAvatar
          avatarId={player.avatarId}
          size={playroomTv.avatar.ready}
          handUp={ready}
          away={player.away}
          testID={`tv-game-player-avatar-${player.id}`}
        />
      ) : null}
      <PlayroomText color={ready ? 'ink' : 'muted'} numberOfLines={1} style={[playroomTv.type.label, styles.name]} accessibilityElementsHidden>
        {player.name}
      </PlayroomText>
      {player.isHost ? (
        <View style={styles.hostTag}>
          <PlayroomText style={playroomTv.type.caption}>HOST</PlayroomText>
        </View>
      ) : null}
    </Animated.View>
  );
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? 'everyone';
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  column: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: playroomTv.safeY - 10,
    gap: 14,
  },
  grid: {
    width: 1380,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 60,
    // Heads break out of the top of their circles, so rows need room above.
    rowGap: 34,
    marginTop: 34,
  },
  seat: {
    width: 216,
    alignItems: 'center',
  },
  name: {
    marginTop: 4,
    fontFamily: playroomTv.type.title.fontFamily,
  },
  hostTag: {
    position: 'absolute',
    top: playroomTv.avatar.ready - 26,
    paddingHorizontal: 14,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.orange,
  },
  bar: {
    width: 1100,
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  segments: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginBottom: 6,
  },
  segment: {
    flex: 1,
    height: 22,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.lavender,
  },
  segmentOn: {
    backgroundColor: playroomColors.orange,
  },
});
