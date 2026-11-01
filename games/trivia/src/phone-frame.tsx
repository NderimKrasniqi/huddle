import type { PhoneSafeAreaInsets } from '@huddle/domain';
import { useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';

import { cosmic, CosmicText, COSMIC_MOTION, cosmicEaseOut, Logo, Pill, timerLabel, Twinkle } from './cosmic';

export function Header({ progress, seconds }: { readonly progress: string; readonly seconds: number }) {
  return (
    <View style={styles.header}>
      <Logo width={120} on="light" />
      <View style={styles.headerRow}>
        <CosmicText weight="black" size={16} accessibilityLabel={`Question ${progress.replace(' / ', ' of ')}`}>{progress}</CosmicText>
        <Pill style={styles.timer} testID="trivia-phone-clock">
          <CosmicText weight="black" size={22} accessibilityLabel={`${seconds} seconds remaining`}>{timerLabel(seconds)}</CosmicText>
        </Pill>
      </View>
    </View>
  );
}

export function PressScale({
  children,
  onPress,
  disabled = false,
  reduceMotion,
  accessibilityLabel,
  accessibilityState,
  testID,
  style,
}: {
  readonly children: ReactNode;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly reduceMotion: boolean | undefined;
  readonly accessibilityLabel: string;
  readonly accessibilityState?: { readonly disabled?: boolean; readonly selected?: boolean };
  readonly testID?: string;
  readonly style?: object;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (value: number) => {
    if (reduceMotion !== false) return;
    Animated.timing(scale, {
      toValue: value,
      duration: value === 1 ? COSMIC_MOTION.release : COSMIC_MOTION.press,
      easing: cosmicEaseOut,
      useNativeDriver: true,
    }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
      testID={testID}
      style={styles.pressable}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Surface({
  insets,
  chromeTop,
  children,
  testID,
  scrollTestID,
  align = 'center',
}: {
  readonly insets: PhoneSafeAreaInsets;
  readonly chromeTop: number;
  readonly children: ReactNode;
  readonly testID: string;
  readonly scrollTestID?: string;
  readonly align?: 'center' | 'stretch';
}) {
  return (
    <View style={styles.screen} testID={testID}>
      <StatusBar barStyle="dark-content" backgroundColor={cosmic.cream} />
      <Twinkle size={22} style={{ left: 28, top: insets.top + 90 }} />
      <Twinkle size={18} style={{ right: 32, top: insets.top + 60 }} />
      <Twinkle size={16} style={{ right: 40, top: '55%' }} />
      <Twinkle size={18} style={{ left: 30, bottom: insets.bottom + 120 }} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: insets.top + chromeTop + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        testID={scrollTestID}
      >
        {align === 'stretch' ? (
          <View style={[styles.page, styles.pageStretch]}>{children}</View>
        ) : (
          <View style={styles.page}>
            <View style={styles.spaceAbove} />
            {children}
            <View style={styles.spaceBelow} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cosmic.cream },
  scroll: { flexGrow: 1 },
  page: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  spaceAbove: { flexGrow: 1 },
  spaceBelow: { flexGrow: 1.8 },
  pageStretch: { alignItems: 'stretch', justifyContent: 'flex-start' },
  header: { alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 2 },
  timer: { paddingHorizontal: 16, paddingVertical: 4, minWidth: 74 },
  pressable: { alignSelf: 'stretch' },
});

export const phoneStyles = StyleSheet.create({
  heading: { marginVertical: 8 },
});
