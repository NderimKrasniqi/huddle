import { useEffect, useState } from 'react';

import { phoneSessionTokenStore } from './session-store';

/** Reads this phone's persisted credential once for subscription arguments. */
export function useSessionToken(): string | undefined {
  const [sessionToken, setSessionToken] = useState<string>();

  useEffect(() => {
    let listening = true;
    phoneSessionTokenStore
      .read()
      .then((stored) => {
        if (listening && stored !== null) setSessionToken(stored);
      })
      .catch(() => undefined);

    return () => {
      listening = false;
    };
  }, []);

  return sessionToken;
}
