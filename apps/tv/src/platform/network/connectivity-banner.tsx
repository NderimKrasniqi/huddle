import { useNetInfo } from '@react-native-community/netinfo';
import { Text, View } from 'react-native';

/** Advisory connectivity feedback. Room heartbeats remain the source of truth. */
export function ConnectivityBanner() {
  const network = useNetInfo();

  if (network.isConnected !== false) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      className="absolute inset-x-12 top-8 z-50 rounded-card bg-ink px-6 py-4"
    >
      <Text className="text-center font-regular text-tv-body text-inverse">
        TV offline — reconnecting to the room…
      </Text>
    </View>
  );
}
