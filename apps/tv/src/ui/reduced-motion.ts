import { useSystemReducedMotion } from '@huddle/ui/native';

/**
 * The TV's motion setting for display: a parent's override, else the device's
 * setting, and still until the device has answered.
 */
export function useTvReducedMotion(override?: boolean): boolean {
  const system = useSystemReducedMotion();
  return override ?? system ?? true;
}
