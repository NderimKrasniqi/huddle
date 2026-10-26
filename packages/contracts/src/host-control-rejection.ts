export type HostControlRejection =
  | { readonly kind: 'notInRoom' }
  | { readonly kind: 'notHost' }
  | { readonly kind: 'targetNotInRoom' }
  | { readonly kind: 'targetIsSelf' }
  | { readonly kind: 'targetAway' };
