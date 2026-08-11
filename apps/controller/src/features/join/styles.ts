import { borderWidth, codeLetterBox, colors, fontFamily, letterSpacing, minBodyFontSize, opacity, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';

const PRESS_TRAVEL = 2;
const AVATAR_TILE = 64;
const AVATAR_GAP = 12;
const AVATAR_COLUMNS = 4;

/** Styles owned by the join surface; shared UI primitives keep their own styles. */
export const styles = StyleSheet.create({
  heading: {
      alignItems: 'center',
      gap: 10,
    },
  title: {
      color: colors.ink,
      fontFamily: fontFamily.bold,
      fontSize: 28,
      // Inter's line box runs taller than its caps; pinning it keeps the
      // heading's own spacing rather than the font's.
      lineHeight: 34,
      textAlign: 'center',
    },
  notice: {
      alignSelf: 'stretch',
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 15,
      lineHeight: 20,
      textAlign: 'center',
    },
  field: {
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 10,
    },
  label: {
      alignSelf: 'flex-start',
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: minBodyFontSize.phone,
      letterSpacing: letterSpacing.label,
    },
  stretch: {
      alignSelf: 'stretch',
    },
  nameField: {
      alignSelf: 'stretch',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.input,
    },
  nameInput: {
      // 50 inside the wrapper's two 3px borders is the handoff's 56px field.
      minHeight: 50,
      paddingHorizontal: 18,
      // Android gives a TextInput its own vertical padding; the wrapper owns the
      // height here, so the field is centred in it rather than pushed off centre.
      paddingVertical: 0,
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 18,
    },
  avatarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: AVATAR_GAP,
      maxWidth: AVATAR_COLUMNS * AVATAR_TILE + (AVATAR_COLUMNS - 1) * AVATAR_GAP,
    },
  avatarChosen: {
      borderColor: colors.accent,
      borderWidth: borderWidth.focus,
    },
  avatarTick: {
      position: 'absolute',
      top: -6,
      right: -6,
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      backgroundColor: colors.accent,
      borderColor: colors.canvas,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.pill,
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
  buttonPressed: {
      transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
    },
  buttonLabel: {
      color: colors.surface,
      fontFamily: fontFamily.semibold,
      fontSize: 18,
    },
  failure: {
      alignSelf: 'stretch',
      color: colors.accent,
      fontFamily: fontFamily.medium,
      fontSize: 15,
      lineHeight: 20,
    },
  tiles: {
      flexDirection: 'row',
      gap: 12,
    },
  tile: {
      width: 64,
      height: 80,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      // Every state carries the same border width, so a cell filling in never
      // nudges the letter beside it.
      borderWidth: borderWidth.hairline,
      // Proportional to the TV tile's 24px on 148px, so the phone's smaller tile
      // reads as the same object (handoff: 10–16px on small elements).
      borderRadius: radius.chip,
    },
  tileActive: {
      borderColor: colors.ink,
    },
  tileEmpty: {
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
  tileLetter: {
      // As on the TV's tiles, and for the same reason there: a Room Code letter
      // takes its box from its cell, never from its own glyph. These cells cannot
      // blank the way the TV's did — an empty one renders a caret or nothing at
      // all, never an empty `<Text>`, so they never file the measurement that
      // poisons an I — but the rule is the rule, and one of them keeping it by
      // accident is not worth the difference.
      ...codeLetterBox,
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 36,
      // As on the TV's tiles: the line box is taller than the caps unless it is
      // pinned to the cap height.
      lineHeight: 40,
    },
  codeInput: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      opacity: 0,
    },
  caret: {
      width: 3,
      height: 36,
      backgroundColor: colors.accent,
    },
  caretHidden: {
      opacity: 0,
    }
});
