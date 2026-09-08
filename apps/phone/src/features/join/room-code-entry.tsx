import { api } from '@huddle/convex';
import { useQuery } from 'convex/react';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';

import { usePhoneSession } from '../../platform/session';
import { codeEntry } from './join-entry';
import { RoomCodeScreen } from './room-code-screen';

/** Root route adapter for manual code entry and availability gating. */
export function RoomCodeEntry() {
  const router = useRouter();
  const { notice, clearNotice } = usePhoneSession();
  const [code, setCode] = useState('');
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
