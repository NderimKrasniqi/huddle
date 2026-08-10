/**
 * Why a host control — transferring the room, or removing a player — was
 * refused.
 *
 * Shaped like the join and lifecycle rejections beside it and thrown the
 * same way: as the `data` of a `ConvexError`, the only part of a thrown error
 * Convex does not redact, so the Host's phone tells the cases apart by `kind`
 * rather than by a message someone may reword.
 *
 * `transferHost` and `removePlayer` share this type because they share their
 * gate: both are the Host naming another seat, and the ways that can be refused
 * are the same four. Whether the *action* then makes sense — you cannot remove
 * yourself, you cannot hand the room to yourself — is `targetIsSelf`, told apart
 * from a target that is simply gone (`targetNotInRoom`).
 *
 * None of these is a refusal a correct Controller sets out to earn: the roster
 * the Host taps a control from is the room's own live subscription, so the host
 * pill and the seats it lists are already the truth. They are reachable anyway
 * — a seat can leave between the render and the tap, and a phone that is not the
 * Host can call these functions, since Huddle authenticates by Session Token and
 * nothing else — so each carries a line the Host can read (see
 * `apps/controller/src/features/room/host-control-rejection.ts`).
 */
export type HostControlRejection =
  /** The acting phone is in no room: its seat expired, or its token is stale. */
  | { readonly kind: 'notInRoom' }
  /** A phone that is not the Host tried to run the room. */
  | { readonly kind: 'notHost' }
  /** The named seat is not in this room — it left, or never was here. */
  | { readonly kind: 'targetNotInRoom' }
  /** The Host named their own seat: there is no transfer or removal to make. */
  | { readonly kind: 'targetIsSelf' }
  /**
   * The Host tried to hand the room to a phone it has stopped hearing from.
   * `transferHost` only — the room a game runs in must have a host who can run
   * it, which is why the automatic handover picks a *connected* successor too.
   * Removal never throws this: removing an away phone is the whole point of it.
   */
  | { readonly kind: 'targetAway' };
