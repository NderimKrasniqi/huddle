/** What the Host's way out of a running game says. */
export function backToLobbyLabel(returning: boolean): string {
  return returning ? 'Returning…' : 'Back to lobby';
}
