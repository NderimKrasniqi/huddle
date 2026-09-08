import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Reads the TV's system motion preference without making the first frame
 * animate. `undefined` is deliberate while the native query resolves.
 */
export function useTvSystemReducedMotion(): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        if (mounted) setEnabled(true);
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setEnabled);
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return enabled;
}

/** Resolves the live display policy while keeping unresolved motion static. */
export function resolveTvReducedMotion(
  override: boolean | undefined,
  system: boolean | undefined,
): boolean {
  return override ?? system ?? true;
}
