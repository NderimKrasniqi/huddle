/**
 * Preserve a typed object for calculated/native-only layout that cannot be a
 * static NativeWind class. Visual values in these objects must still be token
 * references and are checked by the repository lint rules.
 */
export function semanticStyles<const T extends Record<string, object>>(value: T): T {
  return value;
}
