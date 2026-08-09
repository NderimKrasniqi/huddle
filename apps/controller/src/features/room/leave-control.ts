export const LEAVE_ROOM = {
  label: 'Leave',
  busyLabel: 'Leaving…',
  title: 'Leave the room?',
  confirmLabel: 'Leave',
} as const;

/** Describes what this member gives up when leaving the room. */
export function leaveConsequence(joined: number, youAreHost: boolean): string {
  if (joined <= 1) {
    return 'You’re the last one here, so the room closes and its code stops working.';
  }

  return youAreHost
    ? 'Someone else takes over the room. You can rejoin with the same code.'
    : 'You can rejoin with the same code while the room is open.';
}
