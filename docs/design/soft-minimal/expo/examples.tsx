import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { huddlePhoneTheme } from './phone-theme';
import { huddleTvTheme } from './tv-theme';

export function PhonePrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [phoneStyles.button, pressed && phoneStyles.pressed]}>
      <Text style={phoneStyles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const phoneStyles = StyleSheet.create({
  button: {
    minHeight: huddlePhoneTheme.layout.controlMinHeight,
    borderRadius: huddlePhoneTheme.radius.lg,
    backgroundColor: huddlePhoneTheme.colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: huddlePhoneTheme.spacing.lg,
  },
  pressed: { opacity: 0.88 },
  buttonLabel: {
    color: huddlePhoneTheme.colors.text.inverse,
    fontSize: huddlePhoneTheme.typography.body.fontSize,
    fontWeight: '700',
  },
});

export function TvFocusableCard({ focused, title }: { focused: boolean; title: string }) {
  return (
    <View style={[tvStyles.card, focused && tvStyles.focused]}>
      <Text style={tvStyles.title}>{title}</Text>
    </View>
  );
}

const tvStyles = StyleSheet.create({
  card: {
    borderRadius: huddleTvTheme.radius.card,
    borderWidth: huddleTvTheme.focus.borderWidth,
    borderColor: 'transparent',
    backgroundColor: huddleTvTheme.colors.surface.card,
    padding: huddleTvTheme.spacing.xl,
  },
  focused: {
    borderColor: huddleTvTheme.focus.borderColor,
    transform: [{ scale: huddleTvTheme.focus.scale }],
  },
  title: {
    color: huddleTvTheme.colors.text.primary,
    fontSize: huddleTvTheme.typography.heading.fontSize,
    lineHeight: huddleTvTheme.typography.heading.lineHeight,
    fontWeight: '700',
  },
});
