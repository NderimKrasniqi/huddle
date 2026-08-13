import { useNetInfo } from '@react-native-community/netinfo';
import { Text, View } from 'react-native';

/** Advisory connectivity feedback. Server presence and credentials remain authoritative. */
export function ConnectivityBanner() {
  const network = useNetInfo();

  if (network.isConnected !== false) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      className="absolute inset-x-4 top-4 z-50 rounded-card bg-ink px-4 py-3"
    >
      <Text className="text-center font-regular text-phone-body text-inverse">
        You’re offline. Huddle will retry when your connection returns.
      </Text>
    </View>
  );
}
