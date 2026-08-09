/** Public room/lobby feature seam. */
export { lobbyStanding, type LobbyStanding, type RosterSeat } from './host';
export {
  rosterFooterLine,
  rosterRowSlot,
  rosterRowSpokenAs,
  type RosterRowSlot,
} from './host-roster';
export {
  type HostControlAction,
  type RosterRowControl,
  rosterRowControls,
  rosterRowIsManageable,
} from './host-controls';
export { hostControlFailureMessage, hostControlRejectionMessage } from './host-control-rejection';
export { seatLossNotice } from './seat-loss';
export { LEAVE_ROOM, leaveConsequence } from './leave-control';
export { seatedSurface, type SeatedSurface, type SeatedSurfaceInput } from './seated-surface';
