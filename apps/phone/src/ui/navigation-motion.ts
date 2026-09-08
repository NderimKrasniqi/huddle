export type PhoneStackAnimation = 'none' | 'fade' | 'slide_from_bottom';

/**
 * Navigation stays static until the system preference has resolved. This
 * avoids flashing a transition for someone who has Reduce Motion enabled.
 */
export function phoneNavigationAnimations(
  reduceMotion: boolean | undefined,
): { readonly root: PhoneStackAnimation; readonly scan: PhoneStackAnimation } {
  return reduceMotion === false
    ? { root: 'fade', scan: 'slide_from_bottom' }
    : { root: 'none', scan: 'none' };
}
