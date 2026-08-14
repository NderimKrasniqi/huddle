import { type Href, useRouter } from 'expo-router';

import type { PlayerSession } from '../../platform/session';
import { JoinRoomScreen } from './join-room-screen';

export type JoinFormProps = {
  readonly linkedCode: string;
  readonly onSeated: (session: PlayerSession) => void;
  readonly notice?: string;
};

/**
 * Route-facing adapter for the incremental Join Room visual slice.
 *
 * The lifecycle-compatible props stay in place for the later identity and
 * membership pass. This slice deliberately supplies no join mutation: a valid
 * code makes the visual action available, while QR is the only active route.
 */
export function JoinForm(props: JoinFormProps) {
  const router = useRouter();

  return (
    <JoinRoomScreen
      initialCode={props.linkedCode}
      onScanQr={() => router.push('/scan' as Href)}
    />
  );
}
