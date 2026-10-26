type PhoneStackAnimation = 'none' | 'fade' | 'slide_from_bottom';

export function phoneNavigationAnimations(
  reduceMotion: boolean | undefined,
): { readonly root: PhoneStackAnimation; readonly scan: PhoneStackAnimation } {
  return reduceMotion === false
    ? { root: 'fade', scan: 'slide_from_bottom' }
    : { root: 'none', scan: 'none' };
}
