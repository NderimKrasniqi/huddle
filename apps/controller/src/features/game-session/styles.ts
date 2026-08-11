import { borderWidth, colors, fontFamily, letterSpacing, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';

const PRESS_TRAVEL = 2;

/** Styles owned by the session surface; shared UI primitives keep their own styles. */
export const styles = StyleSheet.create({
  title: {
      color: colors.ink,
      fontFamily: fontFamily.bold,
      fontSize: 28,
      // Inter's line box runs taller than its caps; pinning it keeps the
      // heading's own spacing rather than the font's.
      lineHeight: 34,
      textAlign: 'center',
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
  field: {
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 10,
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
  buttonSecondary: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
  buttonPressed: {
      transform: [{ translateX: PRESS_TRAVEL }, { translateY: PRESS_TRAVEL }],
    },
  buttonLabel: {
      color: colors.surface,
      fontFamily: fontFamily.semibold,
      fontSize: 18,
    },
  buttonLabelSecondary: {
      color: colors.ink,
    },
  failure: {
      alignSelf: 'stretch',
      color: colors.accent,
      fontFamily: fontFamily.medium,
      fontSize: 15,
      lineHeight: 20,
    },
  seatedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      justifyContent: 'space-between',
    },
  seatedHeaderEnd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
  codeChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: colors.surface,
      borderColor: colors.ink,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.chip,
    },
  codeChipText: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 20,
      letterSpacing: letterSpacing.roomCode,
      // The room-code chip's letter spacing trails the last letter too; pulling
      // it back keeps the text optically centred in the chip.
      marginRight: -letterSpacing.roomCode,
    },
  finishedHostContent: {
      alignItems: 'stretch',
      gap: 20,
      paddingVertical: 20,
    },
  finishedPlayerContent: {
      alignItems: 'center',
      gap: 20,
      paddingVertical: 28,
    },
  finishedPlayerHeader: {
      alignSelf: 'stretch',
      alignItems: 'center',
      minHeight: 28,
    },
  finishedHero: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 14,
    },
  finishedHeroArt: {
      width: 116,
      height: 116,
      borderRadius: radius.row,
    },
  finishedHeroCopy: {
      flex: 1,
      gap: 6,
    },
  finishedHeroTitle: {
      color: colors.ink,
      fontFamily: fontFamily.bold,
      fontSize: 24,
      lineHeight: 30,
    },
  finishedHeroSubtitle: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 16,
      lineHeight: 22,
    },
  finishedSummaryCard: {
      alignSelf: 'stretch',
      gap: 18,
      padding: 18,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.hairline,
      borderRadius: radius.row,
    },
  finishedSummaryLabel: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 13,
      letterSpacing: letterSpacing.label,
    },
  finishedSummaryStats: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
  finishedSummaryStat: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
  finishedStatIcon: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
  finishedStatIconWinner: {
      backgroundColor: colors.onlineSurface,
    },
  finishedStatValue: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 17,
      textAlign: 'center',
    },
  finishedStatLabel: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 12,
      textAlign: 'center',
    },
  finishedStatIconScore: {
      backgroundColor: colors.soft,
    },
  finishedStatGlyph: {
      color: colors.accent,
      fontFamily: fontFamily.bold,
      fontSize: 25,
    },
  finishedStatIconPlayers: {
      backgroundColor: colors.awayChipSurface,
    },
  finishedRoomFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 12,
      paddingTop: 16,
      borderTopColor: colors.border,
      borderTopWidth: borderWidth.hairline,
    },
  statusDot: {
      width: 12,
      height: 12,
      backgroundColor: colors.online,
      borderRadius: radius.pill,
    },
  finishedRoomFooterCopy: {
      flex: 1,
      gap: 3,
    },
  finishedRoomTitle: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 16,
    },
  finishedRoomSubtitle: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 14,
    },
  finishedPlayerAvatarWell: {
      width: 160,
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.soft,
      borderRadius: radius.pill,
    },
  finishedPlayerGameLine: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 18,
      textAlign: 'center',
    },
  finishedActiveCard: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: 12,
      padding: 18,
      backgroundColor: colors.onlineSurface,
      borderRadius: radius.row,
    },
  finishedActiveCopy: {
      flex: 1,
      gap: 3,
    },
  finishedActiveTitle: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 16,
    },
  finishedActiveSubtitle: {
      color: colors.mutedText,
      fontFamily: fontFamily.medium,
      fontSize: 14,
    },
  finishedActiveBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: colors.online,
      borderRadius: radius.pill,
    },
  finishedActiveBadgeText: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 12,
      letterSpacing: letterSpacing.label,
    },
  explainer: {
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
  finishedPlayerControllerWell: {
      width: 64,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.roomSurface,
      borderRadius: radius.pill,
    },
  finishedPlayerExplainerCopy: {
      flex: 1,
      gap: 3,
    },
  finishedPlayerExplainerTitle: {
      color: colors.ink,
      fontFamily: fontFamily.semibold,
      fontSize: 16,
    },
  explainerText: {
      flex: 1,
      color: colors.ink,
      fontFamily: fontFamily.medium,
      fontSize: 16,
      lineHeight: 22,
    },
  finishedCelebration: {
      position: 'relative',
      alignSelf: 'stretch',
      height: 122,
      overflow: 'hidden',
      marginTop: 2,
    },
  celebrationBlob: {
      position: 'absolute',
      bottom: -70,
      width: 250,
      height: 130,
      backgroundColor: colors.soft,
      borderRadius: radius.pill,
      opacity: 0.55,
    },
  celebrationBlobLeft: {
      left: -70,
      transform: [{ rotate: '9deg' }],
    },
  celebrationBlobRight: {
      right: -70,
      transform: [{ rotate: '-9deg' }],
    },
  celebrationLeaf: {
      position: 'absolute',
      width: 16,
      height: 42,
      backgroundColor: colors.sage,
      borderRadius: radius.pill,
      opacity: 0.58,
    },
  celebrationLeafOne: {
      left: 20,
      bottom: 8,
      transform: [{ rotate: '-28deg' }],
    },
  celebrationLeafTwo: {
      left: 40,
      bottom: 22,
      transform: [{ rotate: '24deg' }],
    },
  celebrationLeafThree: {
      right: 20,
      bottom: 8,
      transform: [{ rotate: '28deg' }],
    },
  celebrationLeafFour: {
      right: 40,
      bottom: 22,
      transform: [{ rotate: '-24deg' }],
    },
  confetti: {
      position: 'absolute',
      width: 8,
      height: 18,
      borderRadius: radius.chip,
    },
  confettiOne: { left: '27%', top: 36, backgroundColor: colors.setupGold, transform: [{ rotate: '-42deg' }] },
  confettiTwo: { left: '38%', top: 68, backgroundColor: colors.justJoined, transform: [{ rotate: '48deg' }] },
  confettiThree: { left: '50%', top: 26, backgroundColor: colors.accent, transform: [{ rotate: '38deg' }] },
  confettiFour: { left: '61%', top: 56, backgroundColor: colors.sage, transform: [{ rotate: '-38deg' }] },
  confettiFive: { left: '72%', top: 28, backgroundColor: colors.setupGold, transform: [{ rotate: '50deg' }] },
  confettiSix: { left: '82%', top: 68, backgroundColor: colors.justJoined, transform: [{ rotate: '-48deg' }] },
  gameStage: {
      alignSelf: 'stretch',
      flex: 1,
    },
  backToLobbyButton: {
      backgroundColor: colors.accent,
    }
});
