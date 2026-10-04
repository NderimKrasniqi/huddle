import { playroomSpacing, playroomTv } from '@huddle/design-tokens';
import { PlayroomHeading, PlayroomMoment, PlayroomText, PlayroomTvStage, PlayroomRosterRow } from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';
import type { RoomInvitationPlayer } from './room-invitation-screen';

export function RoomReturnScreen({ players }: { readonly players: readonly RoomInvitationPlayer[] }) {
  const host = players.find((player) => player.host);
  return <PlayroomTvStage testID="tv-room-return">
    <View style={styles.stack}>
      <PlayroomMoment art="highFive" width={420} height={330} glow />
      <PlayroomText color="muted" style={playroomTv.type.label}>Back in the room</PlayroomText>
      <PlayroomHeading type={playroomTv.type.heading}>Same people. New surprises.</PlayroomHeading>
      <PlayroomText color="muted" numberOfLines={2} style={[playroomTv.type.body, styles.center]}>{`${host?.name ?? 'The host'} is choosing what’s next. Everyone keeps their seat.`}</PlayroomText>
    </View>
    <View style={styles.roster}>
      <PlayroomRosterRow
        players={players.map((player) => ({ ...player, isHost: player.host }))}
        // Avatars are the point of the screen: as large as the room size allows.
        size={players.length > 6 ? playroomTv.avatar.row : playroomTv.avatar.grid}
        width={ROSTER_WIDTH}
      />
    </View>
  </PlayroomTvStage>;
}

const ROSTER_WIDTH = 1920 - playroomTv.safeX * 2 - playroomSpacing[4] * 2;

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, top: playroomTv.safeY + playroomSpacing[5], bottom: 360,
    alignItems: 'center', justifyContent: 'center', gap: playroomSpacing[4] },
  roster: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, bottom: playroomTv.safeY + playroomSpacing[5],
    paddingHorizontal: playroomSpacing[4], paddingTop: playroomSpacing[5], paddingBottom: playroomSpacing[4] },
  center: { textAlign: 'center' },
});
