import { playroomColors, playroomTv } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomText } from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';

import type { TvGamePlayer } from './game-flow-model';

/**
 * Clay props and orange dashes framing an in-room TV screen, kept to the
 * edges so they never sit behind information. They settle once and then
 * hold still.
 */
export function TvPlayroomFrame({ reduceMotion: _reduceMotion }: { readonly reduceMotion: boolean }) {
  return <View pointerEvents="none" accessible={false} style={styles.halo} />;
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
  // A soft glow that bleeds off the stage, so it reads as light, not as a shape
  // whose edge the content keeps crossing.
  halo: { position: 'absolute', width: 2600, height: 1500, left: -340, top: 220, borderRadius: 1300, backgroundColor: playroomColors.lavender, opacity: 0.2 },
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
