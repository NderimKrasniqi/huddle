import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

/** Keep transitions static until the native preference has been resolved. */
export function usePhoneReducedMotion(): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      // If the native accessibility bridge is unavailable, fail closed: a
      // static transition is safe on every platform and avoids surprising
      // motion while the preference is unknown.
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
