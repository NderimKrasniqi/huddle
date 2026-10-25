import { requireNativeModule } from 'expo';

import type { FoundTv } from './index';

type LanDiscoveryModule = {
  /** The TV advertising `code`, or `null` when none answers within `timeoutMs`. */
  find(code: string, timeoutMs: number): Promise<FoundTv | null>;
};

/** TASK-04 spike: Bonjour on iOS, NsdManager on Android (`modules/lan-discovery`). */
export const lanDiscovery = requireNativeModule<LanDiscoveryModule>('LanDiscovery');
export type { FoundTv } from './index';
