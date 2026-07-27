/**
 * Why `joinRoom` turned a phone away.
 *
 * It lives in game-core beside the Room Code format and the Join Link, for the
 * reason they do: it is protocol both sides share. Convex throws it as the
 * `data` of a `ConvexError` — the only part of a thrown error Convex does not
 * redact to "Server Error" — and the Controller's join screen picks its copy by
 * `kind`. The rejections are therefore told apart programmatically, never by
 * matching on a message someone may reword.
 *
 * Each member carries what its copy needs to name the thing that went wrong:
 * the code nobody answered to, the cap that was reached, the name already worn.
 */
export type JoinRejection =
  | { readonly kind: 'roomNotFound'; readonly code: string }
  | { readonly kind: 'roomFull'; readonly cap: number }
  | { readonly kind: 'nameTaken'; readonly nickname: string }
  | { readonly kind: 'nameUnusable'; readonly maxLength: number };
