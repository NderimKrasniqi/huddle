import { ROOM_PLAYER_CAP, roomJoinLink } from '@huddle/domain';
import { huddleAvatarSource } from '@huddle/ui/native';

import type { RosterSeat } from '../../models';
import { RoomInvitationScreen } from './room-invitation-screen';

/** Maps the live room projection into the app-owned illustrated renderer. */
export function RoomStage({
  roomCode,
  roster,
}: {
  readonly roomCode: string;
  readonly roster: readonly RosterSeat[];
}) {
  const players = roster.slice(0, ROOM_PLAYER_CAP).map((seat) => ({
    id: String(seat.playerId),
    name: seat.nickname,
    avatar: huddleAvatarSource(seat.avatar),
  }));

  return (
    <RoomInvitationScreen
      roomCode={roomCode}
      joinUrl={roomJoinLink(roomCode)}
      players={players}
    />
  );
}
