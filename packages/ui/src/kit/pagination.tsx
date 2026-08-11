import { View, type StyleProp, type ViewStyle } from 'react-native';

import { kitStyles } from './styles';
import { huddleUIKitColors, huddleUIKitRadius } from './theme';

/** An accessible pager indicator for browse/carousel surfaces. */
export function PageDots({
  count = 5,
  activeIndex = 2,
  style,
  dotStyle,
  activeDotStyle,
}: {
  readonly count?: number;
  readonly activeIndex?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly dotStyle?: StyleProp<ViewStyle>;
  readonly activeDotStyle?: StyleProp<ViewStyle>;
}) {
  const page = Math.min(activeIndex + 1, count);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Page ${page} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: page }}
      style={[kitStyles.pageDots, style]}
    >
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              {
                width: active ? 13 : 11,
                height: active ? 13 : 11,
                borderRadius: huddleUIKitRadius.pill,
                backgroundColor: active ? huddleUIKitColors.orange : huddleUIKitColors.dotInactive,
              },
              active ? activeDotStyle : dotStyle,
            ]}
          />
        );
      })}
    </View>
  );
}
