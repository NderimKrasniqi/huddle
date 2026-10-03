import { api } from '@huddle/convex';
import type { AvatarId } from '@huddle/domain';
import { useMutation } from 'convex/react';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';

/** Wait for typing to settle before telling the TV. */
const PREVIEW_DEBOUNCE_MS = 300;
/** Well inside the server's 20-second preview lifetime. */
const PREVIEW_REFRESH_MS = 10_000;

/**
 * Shows the TV what this join form is picking — an arriving seat with the
 * avatar and the name as typed — while `active`, and takes it away when the
 * form stops being active or goes away. Best effort: a failed send (an older
 * server, a rate limit, no network) only means the TV shows no preview, so
 * errors are dropped rather than shown to someone who is still choosing.
 */
export function useSeatPreview({
  code,
  nickname,
  avatarId,
  active,
}: {
  readonly code: string;
  readonly nickname: string;
  readonly avatarId: AvatarId;
  readonly active: boolean;
}): void {
  const previewSeat = useMutation(api.seatPreviews.previewSeat);
  const clearSeatPreview = useMutation(api.seatPreviews.clearSeatPreview);
  const [previewKey] = useState(() => Crypto.randomUUID());

  useEffect(() => {
    if (!active) return;
    const send = () => {
      previewSeat({ code, previewKey, nickname, avatar: avatarId }).catch(() => {});
    };
    const settle = setTimeout(send, PREVIEW_DEBOUNCE_MS);
    const refresh = setInterval(send, PREVIEW_REFRESH_MS);
    return () => {
      clearTimeout(settle);
      clearInterval(refresh);
    };
  }, [active, avatarId, code, nickname, previewKey, previewSeat]);

  useEffect(() => {
    if (!active) return;
    return () => {
      clearSeatPreview({ previewKey }).catch(() => {});
    };
  }, [active, clearSeatPreview, previewKey]);
}
