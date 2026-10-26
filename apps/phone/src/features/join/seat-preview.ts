import type { AvatarId } from '@huddle/domain';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';

import { useRoomClient } from '../../platform/room-client/native';

const PREVIEW_DEBOUNCE_MS = 300;
const PREVIEW_REFRESH_MS = 10_000;

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
  const { previewSeat, clearSeatPreview } = useRoomClient();
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
      clearSeatPreview(previewKey).catch(() => {});
    };
  }, [active, clearSeatPreview, previewKey]);
}
