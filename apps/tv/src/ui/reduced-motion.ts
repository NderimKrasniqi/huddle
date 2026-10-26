import { useSystemReducedMotion } from '@huddle/ui/native';

export function useTvReducedMotion(override?: boolean): boolean {
  const system = useSystemReducedMotion();
  return override ?? system ?? true;
}
