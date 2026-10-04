import { playroomPhone } from '@huddle/design-tokens';
import { PlayroomAvatar, PlayroomText } from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';

import type { RosterSeat } from '../../features/room';
import { PhoneCard } from './phone-frame';

/**
 * Who is in the room, for screens where a guest waits on the host: the reason
 * to keep looking is the people, so they fill the space rather than nothing.
 */
export function RoomFaces({ roster }: { readonly roster: readonly RosterSeat[] }) {
  if (roster.length === 0) return null;
  return (
    <PhoneCard style={styles.card}>
      <PlayroomText color="muted" style={playroomPhone.type.caption}>{`In the room · ${roster.length}`}</PlayroomText>
      <View
        style={styles.faces}
        accessible
        accessibilityLabel={`In the room: ${roster.map((seat) => `${seat.nickname}${seat.host ? ', host' : ''}${seat.away ? ', away' : ''}`).join('; ')}`}
        testID="room-faces"
      >
        {roster.map((seat) => (
          <View key={seat.playerId} style={styles.face}>
            <PlayroomAvatar avatarId={seat.avatar} size={44} host={seat.host} away={seat.away} />
            <PlayroomText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[playroomPhone.type.caption, styles.name]} accessibilityElementsHidden>
              {seat.nickname}
            </PlayroomText>
          </View>
        ))}
      </View>
    </PhoneCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
  },
  faces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  face: {
    width: '25%',
    alignItems: 'center',
    gap: 2,
  },
  name: {
    maxWidth: '100%',
    paddingHorizontal: 2,
  },
});
