import { ROOM_PLAYER_CAP, roomJoinLink } from '@huddle/domain';

import type { RosterSeat, SeatArrival } from '../../models';
import { RoomReturnScreen } from './room-return-screen';
import { RoomInvitationScreen } from './room-invitation-screen';

/** Maps the live room projection into the app-owned illustrated renderer. */
export function RoomStage({
  roomCode,
  roster,
  arrivals = [],
  returned,
  welcomeIds,
}: {
  readonly returned?: boolean;
  readonly welcomeIds?: readonly string[];
  readonly roomCode: string;
  readonly roster: readonly RosterSeat[];
  readonly arrivals?: readonly SeatArrival[];
}) {
  const players = roster.slice(0, ROOM_PLAYER_CAP).map((seat) => ({
    id: String(seat.playerId),
    name: seat.nickname,
    avatarId: seat.avatar,
    host: seat.host,
    away: seat.away,
  }));

  if (returned) return <RoomReturnScreen players={players} />;

  return (
    <RoomInvitationScreen
      roomCode={roomCode}
      joinUrl={roomJoinLink(roomCode)}
      players={players}
      arriving={arrivals.map((arrival) => ({ id: String(arrival.previewId), name: arrival.nickname, avatarId: arrival.avatar }))}
      welcomeIds={welcomeIds}
    />
  );
}
