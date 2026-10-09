import { settingSummaryText } from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomEasing, playroomMotion, playroomRadii, playroomTv } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomHeading, PlayroomPill, PlayroomText, PlayroomTvStage } from '@huddle/ui/native';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { tvHostCopy, tvReadiness, type TvGamePlayer, gameTitleFor } from './game-flow-model';
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
  const title = gameTitle?.trim() || gameTitleFor(gameId);
  const { readyCount, playerCount, allReady, minPlayers } = tvReadiness({ gameId, stage, players, readyPlayerIds, playerRange });
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
            // One short chip per setting reads at a glance; one long line did not.
            <View style={styles.chips} testID="tv-game-setup-settings" accessible accessibilityLabel={[title, ...summary].join(', ')}>
              {summary.map((item, index) => (
                <PlayroomPill key={settingsSchema?.[index]?.key ?? index} textStyle={playroomTv.type.caption}>{item}</PlayroomPill>
              ))}
            </View>
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
              {allReady ? tvHostCopy(hostName, 'can start the game') : waitingCopy(waiting, playerCount, minPlayers)}
            </PlayroomText>
          </View>
        </View>
      </PlayroomTvStage>
    </View>
  );
}

/** Names who the room waits for, or how many more players the game needs. */
function waitingCopy(waiting: readonly string[], playerCount: number, min: number | undefined): string {
  if (waiting.length > 0) return `Waiting for ${listNames(waiting)}`;
  const missing = (min ?? 0) - playerCount;
  if (missing > 0) return `Need ${missing} more ${missing === 1 ? 'player' : 'players'} to start`;
  return 'Waiting for everyone';
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
  const lift = useSharedValue(ready && !reduceMotion ? -LIFT : 0);
  useEffect(() => {
    const to = ready && !reduceMotion ? -LIFT : 0;
    lift.set(reduceMotion ? to : withTiming(to, { duration: playroomMotion.entrance, easing: Easing.bezier(...playroomEasing.out) }));
  }, [lift, ready, reduceMotion]);
  const lifted = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  // The phone that raised its hand flashes in this player's colour; the TV echoes it.
  const echo = useSharedValue(0);
  const raised = useRef(ready);
  useEffect(() => {
    const justRaised = ready && !raised.current;
    raised.current = ready;
    if (!justRaised || reduceMotion) return;
    echo.set(0.9);
    echo.set(withTiming(0, { duration: playroomMotion.highlight, easing: Easing.bezier(...playroomEasing.out) }));
  }, [echo, ready, reduceMotion]);
  const echoStyle = useAnimatedStyle(() => ({ opacity: echo.get(), transform: [{ scale: 1 + echo.get() * 0.25 }] }));

  return (
    <Animated.View
      style={[styles.seat, lifted]}
      accessible
      accessibilityLabel={`${player.name}${player.isHost ? ', host' : ''}${player.away ? ', reconnecting' : ready ? ', ready' : ', waiting'}`}
    >
      {player.avatarId ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.echo, { backgroundColor: playroomAvatarCircles[player.avatarId] }, echoStyle]}
        />
      ) : null}
      {player.avatarId ? (
        <PlayroomAvatar
          avatarId={player.avatarId}
          size={playroomTv.avatar.ready}
          handUp={ready}
          host={player.isHost}
          away={player.away}
          testID={`tv-game-player-avatar-${player.id}`}
        />
      ) : null}
      <PlayroomText color={ready ? 'ink' : 'muted'} numberOfLines={1} style={[playroomTv.type.label, styles.name]} accessibilityElementsHidden>
        {player.name}
      </PlayroomText>
      <PlayroomText color={ready ? "success" : "muted"} style={playroomTv.type.caption}>{player.away ? 'Reconnecting' : ready ? 'Ready' : 'Waiting'}</PlayroomText>
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
    justifyContent: 'center',
    paddingTop: 96,
    paddingBottom: playroomTv.safeY,
    // Generous rhythm: a small room fills the stage instead of leaving a band empty below.
    gap: 32,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    maxWidth: 1500,
  },
  grid: {
    width: 1380,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 60,
    // Heads break out of the top of their circles, so rows need room above.
    rowGap: 20,
    marginTop: 48,
  },
  // A disc in the player's own colour behind their avatar, flashed when they raise a hand.
  echo: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: playroomTv.avatar.ready,
    height: playroomTv.avatar.ready,
    borderRadius: playroomTv.avatar.ready / 2,
  },
  seat: {
    width: 216,
    alignItems: 'center',
  },
  name: {
    marginTop: 4,
    fontFamily: playroomTv.type.title.fontFamily,
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
