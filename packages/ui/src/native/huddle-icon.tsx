import { brandColors } from '@huddle/design-tokens';
import { View, type ViewStyle } from 'react-native';

export type HuddleIconName = 'clock' | 'lock' | 'check' | 'people' | 'back' | 'close' | 'pause' | 'tv';
/** Small native line icons share one stroke and remain crisp at every density. */
export function HuddleIcon({ name, size = 20, color = brandColors.espresso }: { readonly name: HuddleIconName; readonly size?: number; readonly color?: string }) {
  const line = (style: ViewStyle, key: string) => <View key={key} style={[{ position: 'absolute', backgroundColor: color, borderRadius: 1 }, style]} />;
  const stroke = Math.max(1.5, size / 10);
  const ring = (style: ViewStyle, key: string) => <View key={key} style={[{ position: 'absolute', borderWidth: stroke, borderColor: color }, style]} />;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    {name === 'clock' ? <>{ring({ inset: 1, borderRadius: size }, 'face')}{line({ left: size / 2 - stroke / 2, top: size * .22, width: stroke, height: size * .3 }, 'hour')}{line({ left: size / 2, top: size / 2, width: size * .25, height: stroke, transform: [{ rotate: '20deg' }] }, 'minute')}</> : null}
    {name === 'lock' ? <>{ring({ left: size * .28, top: size * .05, width: size * .44, height: size * .55, borderRadius: size * .24 }, 'shackle')}{ring({ left: size * .15, top: size * .42, width: size * .7, height: size * .52, borderRadius: 3, backgroundColor: 'transparent' }, 'body')}{line({ left: size / 2 - stroke / 2, top: size * .59, width: stroke, height: size * .18 }, 'key')}</> : null}
    {name === 'check' ? <>{line({ left: size * .13, top: size * .53, width: size * .32, height: stroke, transform: [{ rotate: '45deg' }] }, 'short')}{line({ left: size * .34, top: size * .43, width: size * .57, height: stroke, transform: [{ rotate: '-48deg' }] }, 'long')}</> : null}
    {name === 'back' ? <>{line({ left: size * .2, top: size * .29, width: size * .53, height: stroke, transform: [{ rotate: '-45deg' }] }, 'upper')}{line({ left: size * .2, top: size * .66, width: size * .53, height: stroke, transform: [{ rotate: '45deg' }] }, 'lower')}</> : null}
    {name === 'close' ? <>{line({ left: size * .1, top: size / 2, width: size * .8, height: stroke, transform: [{ rotate: '45deg' }] }, 'a')}{line({ left: size * .1, top: size / 2, width: size * .8, height: stroke, transform: [{ rotate: '-45deg' }] }, 'b')}</> : null}
    {name === 'pause' ? <>{line({ left: size * .23, top: size * .16, width: size * .18, height: size * .68 }, 'a')}{line({ right: size * .23, top: size * .16, width: size * .18, height: size * .68 }, 'b')}</> : null}
    {name === 'people' ? <>{line({ left: size * .13, top: size * .08, width: size * .28, height: size * .28, borderRadius: size }, 'head1')}{line({ right: size * .08, top: size * .17, width: size * .25, height: size * .25, borderRadius: size }, 'head2')}{line({ left: 0, bottom: size * .1, width: size * .55, height: size * .45, borderTopLeftRadius: size, borderTopRightRadius: size }, 'body1')}{line({ right: 0, bottom: size * .1, width: size * .4, height: size * .39, borderTopLeftRadius: size, borderTopRightRadius: size }, 'body2')}</> : null}
    {name === 'tv' ? <>{ring({ left: 1, top: size * .17, width: size - 2, height: size * .62, borderRadius: 3 }, 'screen')}{line({ left: size * .3, bottom: size * .05, width: size * .4, height: stroke }, 'stand')}</> : null}
  </View>;
}
