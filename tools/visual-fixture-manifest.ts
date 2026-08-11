/**
 * Canonical visual-fixture inventory for the approved reference states.
 *
 * The references are device/mockup exports, while captures are made from the
 * app interior. Keeping the capture viewport here prevents a bezel or system
 * chrome from silently becoming part of a parity comparison.
 */

export const PHONE_FIXTURE_VIEWPORT = { width: 393, height: 852 } as const;
export const TV_FIXTURE_VIEWPORT = { width: 1672, height: 941 } as const;

export const PHONE_REFERENCE_FIXTURES = [
  { id: 'join', reference: 'docs/design/reference/screens/01-join-room.png', referenceSize: [1086, 1448] },
  { id: 'host-room', reference: 'docs/design/reference/screens/02-your-room-host.png', referenceSize: [1024, 1536] },
  { id: 'manage-player', reference: 'docs/design/reference/screens/03-manage-player-host.png', referenceSize: [1086, 1448] },
  { id: 'game-picker', reference: 'docs/design/reference/screens/04-pick-a-game-host.png', referenceSize: [1086, 1448] },
  { id: 'player-waiting', reference: 'docs/design/reference/screens/05-waiting-player.png', referenceSize: [1086, 1448] },
  { id: 'settings-standard', reference: 'docs/design/reference/screens/06-game-settings-host-standard.png', referenceSize: [1029, 2154] },
  { id: 'settings-quick', reference: 'docs/design/reference/screens/07-game-settings-host-quick.png', referenceSize: [1035, 2154] },
  { id: 'settings-custom', reference: 'docs/design/reference/screens/08-game-settings-host-custom.png', referenceSize: [1032, 2154] },
  { id: 'finished-player', reference: 'docs/design/reference/screens/09-game-finished-player.png', referenceSize: [941, 1672] },
  { id: 'finished-host', reference: 'docs/design/reference/screens/10-game-finished-host.png', referenceSize: [941, 1672] },
] as const;

export const TV_REFERENCE_FIXTURES = [
  { id: 'game-setup', reference: 'docs/design/reference/screens/03-game-setup.png', referenceSize: [1672, 941] },
] as const;
