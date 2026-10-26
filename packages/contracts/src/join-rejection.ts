export type JoinRejection =
  | { readonly kind: 'guestIdInvalid' }
  | { readonly kind: 'roomNotFound'; readonly code: string }
  | { readonly kind: 'roomFull'; readonly cap: number }
  | { readonly kind: 'nameTaken'; readonly nickname: string }
  | { readonly kind: 'nameUnusable'; readonly maxLength: number }
  | { readonly kind: 'avatarTaken'; readonly avatar: string }
  | { readonly kind: 'avatarUnknown'; readonly avatar: string };
