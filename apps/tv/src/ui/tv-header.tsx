import { Wordmark } from '@huddle/ui/native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { tvLayout } from './tv-layout';

/** Shared wordmark header used by full-screen TV surfaces. */
export function TvHeader({ trailing }: { readonly trailing?: ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: 56,
        paddingTop: tvLayout.headerTop,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Wordmark height={tvLayout.wordmark} />
      {trailing}
    </View>
  );
}
