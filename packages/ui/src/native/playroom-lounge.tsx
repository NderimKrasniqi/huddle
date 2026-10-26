import type { AvatarId } from '@huddle/contracts';
import { playroomColors, playroomCoverColors, playroomRadii, playroomTv } from '@huddle/design-tokens';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PLAYROOM_ARTWORK, playroomGameArt } from './playroom-artwork';
import { PlayroomAvatar } from './playroom-avatar';
import { PlayroomText } from './playroom-text';

const ROSTER_GAP = 24;

export function PlayroomRosterRow({ players, size = 100, width }: {
  readonly players: readonly { readonly id: string; readonly name: string; readonly avatarId?: AvatarId; readonly isHost?: boolean; readonly away?: boolean }[];
  readonly size?: number;
  readonly width?: number;
}) {
  const shown = players.slice(0, 10);
  const seatWidth = width === undefined ? 130 : Math.min(320, Math.floor((width - ROSTER_GAP * (shown.length - 1)) / Math.max(1, shown.length)));
  return <View style={styles.roster}>
    {shown.map((player) => <View key={player.id} style={[styles.seat, { width: seatWidth }]} accessible
      accessibilityLabel={`${player.name}${player.isHost ? ', host' : ''}${player.away ? ', reconnecting' : ''}`}>
      {player.avatarId ? <PlayroomAvatar avatarId={player.avatarId} size={size} host={player.isHost} away={player.away} /> : null}
      <PlayroomText
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[width === undefined || seatWidth < 180 ? playroomTv.type.caption : playroomTv.type.label, styles.seatName]}
      >{player.name}</PlayroomText>
    </View>)}
  </View>;
}

export function playroomCoverColor(gameId: string): string {
  return playroomCoverColors[gameId] ?? playroomColors.lavender;
}

export function PlayroomMoment({ art, width, height, style, glow = false }: {
  readonly art: keyof typeof PLAYROOM_ARTWORK.moments;
  readonly width: number;
  readonly height: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly glow?: boolean;
}) {
  const outer = Math.min(width, height) * 1.05;
  return <View style={style} pointerEvents="none" accessible={false}>
    <View style={{ width, height, maxWidth: '100%', alignItems: 'center', justifyContent: 'center' }}>
      {glow ? GLOW_RINGS.map((ring) => <View
        key={ring}
        style={[styles.glowRing, { width: outer * ring, height: outer * ring, borderRadius: (outer * ring) / 2 }]}
      />) : null}
      <Image source={PLAYROOM_ARTWORK.moments[art]} style={{ width, height, maxWidth: '100%' }} resizeMode="contain" accessible={false} />
    </View>
  </View>;
}

const FULL_BLEED_COVERS: ReadonlySet<string> = new Set(['trivia']);

const GLOW_RINGS = [1, 0.88, 0.76, 0.64, 0.52] as const;

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
    {GLOW_RINGS.map((ring) => <View key={ring} style={[styles.light, { width: `${ring * 96}%`, height: `${ring * 120}%` }]} />)}
    {source ? <Image source={source} style={styles.art} resizeMode="contain" accessible={false} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  roster: { flexDirection: 'row', justifyContent: 'center', gap: ROSTER_GAP },
  seat: { width: 130, alignItems: 'center', gap: 6 },
  seatName: { maxWidth: '100%', textAlign: 'center' },
  cover: { alignItems: 'center', justifyContent: 'center', borderRadius: playroomRadii.card, overflow: 'hidden' },
  glowRing: { position: 'absolute', backgroundColor: playroomColors.lavender, opacity: 0.09 },
  light: { position: 'absolute', borderRadius: 999, backgroundColor: playroomColors.surface, opacity: 0.12 },
  art: { width: '88%', height: '88%' },
  scene: { width: '100%', height: '100%' },
});
