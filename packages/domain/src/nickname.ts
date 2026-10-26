export const NICKNAME_MAX_LENGTH = 20;

export function nameList(names: readonly string[], shown = 2): string {
  if (names.length <= shown + 1) {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const rest = names.length - shown;
  return `${names.slice(0, shown).join(', ')} and ${rest} others`;
}
