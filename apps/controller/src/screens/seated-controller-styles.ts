import { borderWidth, colors, fontFamily, letterSpacing, minBodyFontSize, opacity, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';

const PRESS_TRAVEL = 2;

/** Styles owned by the seated surface; shared UI primitives keep their own styles. */
export const styles = StyleSheet.create({
  waitingScreenContent: {
      gap: 24,
      paddingVertical: 24,
    },
  roomFooter: {
      alignSelf: 'stretch',
      gap: 20,
      marginTop: 'auto',
    },
  roomTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      alignSelf: 'stretch',
      justifyContent: 'space-between',
      gap: 12,
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
  roster: {
      alignSelf: 'stretch',
    },
  countLine: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 10,
    },
  statusDot: {
      width: 12,
      height: 12,
      backgroundColor: colors.online,
      borderRadius: radius.pill,
    },
  aside: {
      alignSelf: 'stretch',
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 15,
    },
  waitingFor: {
      alignSelf: 'stretch',
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 15,
      lineHeight: 20,
    },
  asideCentred: {
      textAlign: 'center',
    },
  waitingHero: {
      alignItems: 'center',
      gap: 18,
      marginTop: 10,
    },
  waitingAvatarWell: {
      width: 192,
      height: 192,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.soft,
      borderRadius: radius.pill,
    },
  waitingTitle: {
      color: colors.ink,
      fontFamily: fontFamily.bold,
      fontSize: 25,
      lineHeight: 31,
      textAlign: 'center',
    },
  waitingStatusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 12,
      paddingHorizontal: 18,
      minHeight: 64,
      backgroundColor: colors.onlineSurface,
      borderRadius: radius.row,
    },
  statusDotHalo: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.onlineSurface,
      borderRadius: radius.pill,
    },
  statusText: {
      flex: 1,
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 16,
      lineHeight: 22,
    },
  waitingInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 16,
      paddingHorizontal: 18,
      minHeight: 100,
      borderColor: colors.border,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.row,
    },
  waitingInfoIconCircle: {
      width: 53,
      height: 53,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
    },
  waitingInfoText: {
      flex: 1,
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 16,
      lineHeight: 22,
    },
  sheetRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
  sheetScrim: {
      backgroundColor: colors.ink,
      opacity: opacity.scrim,
    },
  sheetWrapper: {
      alignSelf: 'stretch',
    },
  sheet: {
      alignSelf: 'stretch',
      gap: 14,
      padding: 20,
      paddingBottom: 28,
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderWidth: borderWidth.hairline,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
    },
  sheetGrabber: {
      alignSelf: 'center',
      width: 64,
      height: 5,
      marginBottom: 4,
      backgroundColor: colors.border,
      borderRadius: radius.pill,
    },
  sheetCancel: {
      alignSelf: 'center',
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
  sheetCancelLabel: {
      color: colors.mutedText,
      fontFamily: fontFamily.semibold,
      fontSize: 16,
    },
  sheetTitle: {
      alignSelf: 'stretch',
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 20,
    },
  sheetBody: {
      alignSelf: 'stretch',
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: minBodyFontSize.phone,
      lineHeight: 20,
    },
  stretch: {
      alignSelf: 'stretch',
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
  rosterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 12,
      paddingVertical: 13,
    },
  rosterRowRuled: {
      borderTopColor: colors.border,
      borderTopWidth: borderWidth.hairline,
    },
  rosterAway: {
      opacity: opacity.unavailable,
    },
  rosterName: {
      flex: 1,
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 16,
    },
  rosterHostSlot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
  rosterHostLabel: {
      color: colors.accent,
      fontFamily: fontFamily.semibold,
      fontSize: 16,
    },
  rosterNameAway: {
      color: colors.mutedText,
    },
  rosterYou: {
      color: colors.mutedText,
    },
  justJoinedChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderColor: colors.justJoined,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.chip,
    },
  justJoinedText: {
      color: colors.justJoined,
      fontFamily: fontFamily.semibold,
      fontSize: minBodyFontSize.phone,
      letterSpacing: letterSpacing.label,
      marginRight: -letterSpacing.label,
    },
  sheetHeaderCentered: {
      alignItems: 'center',
      gap: 6,
    },
  sheetAwayBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      padding: 5,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.pill,
    },
  sheetName: {
      flex: 1,
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 20,
    },
  sheetNameCentered: {
      alignSelf: 'stretch',
      flex: 0,
      textAlign: 'center',
    },
  sheetState: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 16,
    },
  buttonInert: {
      backgroundColor: colors.border,
      borderColor: colors.border,
    },
  buttonSecondary: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  buttonLabelInert: {
      color: colors.mutedText,
    },
  buttonLabelSecondary: {
      color: colors.ink,
    }
});
