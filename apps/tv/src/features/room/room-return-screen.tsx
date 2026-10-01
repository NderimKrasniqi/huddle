import { playroomColors, playroomTv } from '@huddle/design-tokens';
import { PlayroomHeading, PlayroomMoment, PlayroomText, PlayroomTvStage, PlayroomRosterRow } from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';
import type { RoomInvitationPlayer } from './room-invitation-screen';

export function RoomReturnScreen({ players }: { readonly players: readonly RoomInvitationPlayer[] }) {
  const host = players.find((player) => player.host);
  return <PlayroomTvStage testID="tv-room-return">
    <View style={styles.stack}>
      <PlayroomMoment art="highFive" width={360} height={290} />
      <PlayroomText color="muted" style={playroomTv.type.label}>Back in the room</PlayroomText>
      <PlayroomHeading type={playroomTv.type.heading}>Same people. New surprises.</PlayroomHeading>
      <PlayroomText color="muted" style={playroomTv.type.body}>{`${host?.name ?? 'The Host'} is choosing what’s next. Everyone keeps their seat.`}</PlayroomText>
    </View>
    <View style={styles.roster}>
      <PlayroomRosterRow players={players.map((player) => ({ ...player, isHost: player.host }))} size={100} />
    </View>
  </PlayroomTvStage>;
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, top: 140, bottom: 290,
    alignItems: 'center', justifyContent: 'center', gap: 20 },
  roster: { position: 'absolute', left: playroomTv.safeX, right: playroomTv.safeX, bottom: 90,
    paddingHorizontal: 20, paddingTop: 34, paddingBottom: 20, borderRadius: 32, backgroundColor: playroomColors.lavender },
});
