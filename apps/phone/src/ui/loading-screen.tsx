import { HuddleText, HEARTBEAT_ARTWORK, LoadingMark, ScreenShell } from '@huddle/ui/native';
import { Image, ImageBackground, StyleSheet, View } from 'react-native';

import { phoneLoadingPresentation, type PhoneLoadingPhase } from './loading-state';

/** Branded startup/session-restoring screen for the phone app. */
export function PhoneLoadingScreen({ phase }: { readonly phase: PhoneLoadingPhase }) {
  return (
    <ScreenShell
      tone="background"
      testID={`phone-${phase}-surface`}
      style={styles.shell}
    >
      <ImageBackground
        source={HEARTBEAT_ARTWORK.phone.joinEnvironment}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
        testID="heartbeat-loading-environment"
      >
        <View pointerEvents="none" style={styles.environmentVeil} />
      </ImageBackground>
      <View style={styles.content}>
        <View style={styles.brand}>
          <Image source={HEARTBEAT_ARTWORK.brand.displayMark} resizeMode="contain" style={styles.brandMark} accessible={false} />
          <HuddleText variant="display" align="center">Huddle</HuddleText>
        </View>
        <View style={styles.loadingMark}>
          <LoadingMark size={112} accessibilityLabel="Huddle loading" testID="phone-loading-mark" />
        </View>
        <View style={styles.copy}>
          <HuddleText variant="title" align="center" accessibilityRole="alert">
            {phoneLoadingPresentation(phase).purpose}
          </HuddleText>
          <HuddleText variant="body" align="center" style={styles.message}>
            {phase === 'restoring' ? 'This will just take a moment…' : 'Getting the room ready…'}
          </HuddleText>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = {
  shell: {
    paddingHorizontal: 0,
    overflow: 'hidden',
    alignItems: 'center',
  },
  environmentVeil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#F9F1E6',
    opacity: 0.14,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 72,
  },
  brand: {
    alignItems: 'center',
    gap: 6,
  },
  brandMark: {
    width: 76,
    height: 64,
  },
  loadingMark: {
    flex: 1,
    justifyContent: 'center',
  },
  copy: {
    alignItems: 'center',
    gap: 8,
  },
  message: { opacity: 0.72 },
} as const;
