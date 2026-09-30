import { api } from '@huddle/convex';
import { useQuery } from 'convex/react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { usePhoneSession } from '../../platform/session';
import { codeEntry } from './join-entry';
import { RoomCodeScreen } from './room-code-screen';

/** Root route adapter for manual code entry and availability gating. */
export function RoomCodeEntry() {
  const router = useRouter();
  const { notice, clearNotice } = usePhoneSession();
  // Set when a join link named a room that does not exist, so the tiles show
  // the code alongside the inline "no room" message.
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const linkedCode = codeEntry(Array.isArray(params.code) ? params.code[0] ?? '' : params.code ?? '');
  const [code, setCode] = useState(linkedCode);
  const [lastLinkedCode, setLastLinkedCode] = useState(linkedCode);
  if (linkedCode !== lastLinkedCode) {
    setLastLinkedCode(linkedCode);
    if (linkedCode) setCode(linkedCode);
  }
  const availability = useQuery(
    api.players.joinAvailability,
    code.length === 4 ? { code } : 'skip',
  );

  function handleCodeChange(next: string) {
    setCode(codeEntry(next));
    if (notice) clearNotice();
  }

  function continueToIdentity(nextCode: string) {
    if (nextCode.length !== 4 || availability === undefined || availability === null || availability.full) return;
    router.push(`/join/${nextCode}` as Href);
  }

  return (
    <RoomCodeScreen
      code={code}
      availability={availability}
      onCodeChange={handleCodeChange}
      onContinue={continueToIdentity}
      onScanQr={() => router.push('/scan' as Href)}
      error={notice}
    />
  );
}
