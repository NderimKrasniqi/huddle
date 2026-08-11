import { borderWidth, codeLetterBox, colors, fontFamily, letterSpacing, minBodyFontSize, opacity, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';

const PRESS_TRAVEL = 2;

/** Styles owned by the ui surface; shared UI primitives keep their own styles. */
export const styles = StyleSheet.create({
  seatedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'space-between',
    },
  roomCode: {
      alignItems: 'center',
      gap: 4,
    },
  roomCodeLabel: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: minBodyFontSize.phone,
      letterSpacing: letterSpacing.label,
      marginRight: -letterSpacing.label,
    },
  roomCodeLetters: {
      flexDirection: 'row',
      gap: 4,
    },
  roomCodeLetter: {
      minWidth: 24,
      alignItems: 'center',
      paddingHorizontal: 5,
      paddingVertical: 3,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.chip,
    },
  roomCodeLetterText: {
      ...codeLetterBox,
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 18,
      lineHeight: 22,
    },
  outlinePill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderColor: colors.accent,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.pill,
    },
  buttonPressed: {
      transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
    },
  outlinePillText: {
      color: colors.accent,
      fontFamily: fontFamily.semibold,
      fontSize: 15,
    },
  stretch: {
      alignSelf: 'stretch',
    },
  buttonUnavailable: {
      opacity: opacity.unavailable,
    },
  button: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'center',
      // The gap a button with an icon needs, and nothing on one without: an empty
      // flex gap costs a button with a single label nothing.
      gap: 10,
      minHeight: 56,
      backgroundColor: colors.accent,
      borderColor: colors.ink,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.button,
    },
  buttonLabel: {
      color: colors.surface,
      fontFamily: fontFamily.semibold,
      fontSize: 18,
    }
});
