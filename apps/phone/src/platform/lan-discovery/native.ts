import { requireNativeModule } from 'expo';

import type { FoundTv } from './index';

type LanDiscoveryModule = {
  find(code: string, timeoutMs: number): Promise<FoundTv | null>;
};

export const lanDiscovery = requireNativeModule<LanDiscoveryModule>('LanDiscovery');
export type { FoundTv } from './index';
