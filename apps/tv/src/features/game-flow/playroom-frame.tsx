import { playroomColors, playroomTv } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomFloat, PlayroomText } from '@huddle/ui/native';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { TvGamePlayer } from './game-flow-model';

/**
 * Clay props and orange dashes framing an in-room TV screen, kept to the
 * edges so they never sit behind information. They settle once and then
 * hold still.
 */
export function TvPlayroomFrame({ reduceMotion }: { readonly reduceMotion: boolean }) {
  return (
    <>
      <PlayroomFloat prop="starYellow" width={123} height={123} style={{ left: 31, bottom: 35 }} reduceMotion={reduceMotion} />
      <PlayroomFloat prop="ballPurple" width={58} height={58} style={{ left: 165, bottom: 46 }} reduceMotion={reduceMotion} delay={80} />
      <PlayroomFloat prop="starPurple" width={81} height={81} style={{ left: 46, top: 230 }} reduceMotion={reduceMotion} delay={40} />
      <PlayroomFloat prop="ballCream" width={46} height={46} style={{ left: 84, top: 353 }} reduceMotion={reduceMotion} delay={120} />
      <PlayroomFloat prop="ballOrange" width={108} height={108} style={{ right: 50, bottom: 38 }} reduceMotion={reduceMotion} delay={40} />
      <PlayroomFloat prop="ballPurple" width={58} height={58} style={{ right: 65, bottom: 192 }} reduceMotion={reduceMotion} delay={160} />
      <PlayroomFloat prop="starPurple" width={88} height={88} style={{ right: 50, top: 192 }} reduceMotion={reduceMotion} delay={80} />
      <PlayroomFloat prop="ballOrange" width={65} height={65} style={{ right: 161, top: 58 }} reduceMotion={reduceMotion} delay={120} />
      <Dash style={{ left: 223, top: 941, transform: [{ rotate: '-35deg' }] }} />
      <Dash style={{ left: 257, top: 1006, transform: [{ rotate: '15deg' }] }} />
      <Dash style={{ left: 1659, top: 941, transform: [{ rotate: '35deg' }] }} />
      <Dash style={{ left: 1628, top: 1006, transform: [{ rotate: '-15deg' }] }} />
    </>
  );
}

function Dash({ style }: { readonly style: ViewStyle }) {
  return <View style={[styles.dash, style]} pointerEvents="none" accessible={false} />;
}

export type TvRosterRowProps = {
  readonly players: readonly TvGamePlayer[];
  readonly size?: number;
  /** Show names under the avatars. */
  readonly names?: boolean;
  readonly testID?: string;
};

/** The room's players in one row along the bottom of a screen. */
export function TvRosterRow({ players, size = playroomTv.avatar.row, names = true, testID }: TvRosterRowProps) {
  return (
    <View style={styles.row} pointerEvents="none" focusable={false} testID={testID}>
      {players.map((player) => (
        <View
          key={player.id}
          style={styles.seat}
          accessible
          accessibilityLabel={`${player.name}${player.isHost ? ', host' : ''}${player.away ? ', away' : ''}`}
        >
          {player.avatarId ? (
            <PlayroomAvatar
              avatarId={player.avatarId}
              size={size}
              host={player.isHost}
              away={player.away}
              testID={`tv-game-player-avatar-${player.id}`}
            />
          ) : null}
          {names ? (
            <PlayroomText numberOfLines={1} style={[playroomTv.type.caption, styles.name]} accessibilityElementsHidden>
              {player.name}
            </PlayroomText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dash: {
    position: 'absolute',
    width: 42,
    height: 10,
    borderRadius: 5,
    backgroundColor: playroomColors.orange,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 26,
  },
  seat: {
    alignItems: 'center',
    maxWidth: 140,
  },
  name: {
    marginTop: 4,
    fontFamily: playroomTv.type.title.fontFamily,
  },
});
