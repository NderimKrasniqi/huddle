export function clampBrowsingIndex(stored: number | undefined | null, total: number): number {
  if (stored === undefined || stored === null || !Number.isFinite(stored)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(stored), 0), Math.max(total - 1, 0));
}
