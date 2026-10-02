import type { AvatarId } from '@huddle/contracts';
import { playroomColors, playroomCoverColors, playroomRadii, playroomTv } from '@huddle/design-tokens';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PLAYROOM_ARTWORK, playroomGameArt } from './playroom-artwork';
import { PlayroomAvatar } from './playroom-avatar';
import { PlayroomText } from './playroom-text';

export function PlayroomRosterRow({ players, size = 100 }: {
  readonly players: readonly { readonly id: string; readonly name: string; readonly avatarId?: AvatarId; readonly isHost?: boolean; readonly away?: boolean }[];
  readonly size?: number;
}) {
  return <View style={styles.roster}>
    {players.slice(0, 10).map((player) => <View key={player.id} style={styles.seat} accessible
      accessibilityLabel={`${player.name}${player.isHost ? ', host' : ''}${player.away ? ', reconnecting' : ''}`}>
      {player.avatarId ? <PlayroomAvatar avatarId={player.avatarId} size={size} host={player.isHost} away={player.away} /> : null}
      <PlayroomText numberOfLines={1} style={playroomTv.type.caption}>{player.name}</PlayroomText>
    </View>)}
  </View>;
}

export function playroomCoverColor(gameId: string): string {
  return playroomCoverColors[gameId] ?? playroomColors.lavender;
}

export function PlayroomMoment({ art, width, height, style }: {
  readonly art: keyof typeof PLAYROOM_ARTWORK.moments;
  readonly width: number;
  readonly height: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  return <View style={style} pointerEvents="none" accessible={false}>
    <Image source={PLAYROOM_ARTWORK.moments[art]} style={{ width, height, maxWidth: '100%' }} resizeMode="contain" accessible={false} />
  </View>;
}

/** Games whose cover is a full scene rather than a prop on a pastel card. */
const FULL_BLEED_COVERS: ReadonlySet<string> = new Set(['trivia']);

/** Text-free cover art; native labels belong to the surrounding screen. */
export function PlayroomGameCover({ gameId, height, style }: {
  readonly gameId: string;
  readonly height: number;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const source = playroomGameArt(gameId);
  if (source && FULL_BLEED_COVERS.has(gameId)) {
    return <View style={[styles.cover, { height, backgroundColor: playroomCoverColor(gameId) }, style]} accessible={false}>
      <Image source={source} style={styles.scene} resizeMode="cover" accessible={false} />
    </View>;
  }
  return <View style={[styles.cover, { height, backgroundColor: playroomCoverColor(gameId) }, style]} accessible={false}>
    <View style={styles.halo} />
    {source ? <Image source={source} style={styles.art} resizeMode="contain" accessible={false} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  roster: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  seat: { width: 130, alignItems: 'center', gap: 6 },
  cover: { alignItems: 'center', justifyContent: 'center', borderRadius: playroomRadii.card, overflow: 'hidden' },
  halo: { position: 'absolute', width: '80%', height: '70%', borderRadius: 999, backgroundColor: playroomColors.surface, opacity: 0.3 },
  art: { width: '90%', height: '90%' },
  scene: { width: '100%', height: '100%' },
});
