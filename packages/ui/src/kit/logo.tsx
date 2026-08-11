import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fontFamily } from '../typography';

import { huddleUIKitColors } from './theme';

export function HuddleMark({ size = 38 }: { readonly size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityElementsHidden>
      <Circle cx="25.5" cy="8.5" r="6.5" fill={huddleUIKitColors.orange} />
      <Path d="M20.5 15.5c4.8-4 12.8-2 14 3.4 1.2 5.6-4 11.1-13.8 11.1-2.2-4.8-2.5-10 .8-14.5Z" fill={huddleUIKitColors.orange} />
      <Path d="M8.2 10.8c4-2.4 8.3-.1 8 4.3-.4 5-4.5 8.5-10.8 7.6-1.7-4.2-1.1-9.5 2.8-11.9Z" fill={huddleUIKitColors.orange} />
      <Path d="M6.8 25.1c3.7-2.2 8.5-.6 9.5 3.5.9 4.1-2.3 8.2-8.6 9-3.4-3.3-4.7-9.9-.9-12.5Z" fill={huddleUIKitColors.orange} />
    </Svg>
  );
}

export function HuddleLogo({
  size = 38,
  showWordmark = true,
  style,
}: {
  readonly size?: number;
  readonly showWordmark?: boolean;
  readonly style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      <HuddleMark size={size} />
      {showWordmark ? (
        <Text
          style={{
            color: huddleUIKitColors.navy,
            fontFamily: fontFamily.bold,
            fontSize: size * 0.82,
            letterSpacing: -1,
          }}
        >
          HUDDLE
        </Text>
      ) : null}
    </View>
  );
}
