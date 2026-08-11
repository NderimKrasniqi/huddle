/** What the Host's way out of a running game says. */
export function backToLobbyLabel(returning: boolean): string {
  return returning ? 'Returning…' : 'Back to lobby';
}

export const LEAVE_ROOM = {
  label: 'Leave',
  busyLabel: 'Leaving…',
  title: 'Leave the room?',
  confirmLabel: 'Leave',
} as const;

/** Describes what this member gives up when leaving the room. */
export function leaveConsequence(joined: number, youAreHost: boolean): string {
  if (joined <= 1) {
    return 'The TV keeps this room open. You can rejoin with the same code.';
  }

  return youAreHost
    ? 'Someone else takes over the room. You can rejoin with the same code.'
    : 'You can rejoin with the same code while the room is open.';
}
