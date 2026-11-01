import { useEffect, useEffectEvent } from 'react';

export function useOncePerKey(key: string | undefined, run: () => void): void {
  const fire = useEffectEvent(run);
  useEffect(() => {
    if (key !== undefined) fire();
  }, [key]);
}
