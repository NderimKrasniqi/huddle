import { Platform, Text, View } from 'react-native';

import { kitStyles } from './styles';
import { huddleUIKitColors, huddleUIKitRadius, huddleUIKitShadow, huddleUIKitTypography } from './theme';

/** A single character in the shared room-code presentation. */
export function RoomCodeTile({ character }: { readonly character: string }) {
  const size = Platform.isTV ? 76 : 54;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: huddleUIKitColors.surface,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
        borderRadius: huddleUIKitRadius.sm,
        ...huddleUIKitShadow,
      }}
    >
      <Text
        style={{
          fontSize: Platform.isTV ? 34 : 26,
          color: huddleUIKitColors.navy,
          fontFamily: huddleUIKitTypography.bold,
        }}
      >
        {character.toUpperCase()}
      </Text>
    </View>
  );
}

/** The complete code, exposed as one accessible text surface. */
export function RoomCode({ code }: { readonly code: string }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Room code ${code.split('').join(' ')}`}
      style={[kitStyles.roomCode, { gap: Platform.isTV ? 14 : 8 }]}
    >
      {code.split('').map((character, index) => (
        <RoomCodeTile key={`${character}-${index}`} character={character} />
      ))}
    </View>
  );
}
