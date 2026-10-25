import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Whether this screen is the one on top. Each join link pushes a screen and the
 * earlier ones stay mounted underneath, so anything that keeps asking the TV
 * (room availability every three seconds) runs only while its screen is visible.
 */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}
