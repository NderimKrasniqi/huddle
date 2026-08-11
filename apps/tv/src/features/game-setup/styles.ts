import { borderWidth, colors, fontFamily, minBodyFontSize, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 34, paddingVertical: 28 },
  setupLeft: { width: 700, gap: 14 },
  setupEyebrow: { color: colors.setupMuted, fontFamily: fontFamily.semibold, fontSize: 16, letterSpacing: 3, marginTop: 22 },
  setupTitle: { color: colors.setupText, fontFamily: fontFamily.bold, fontSize: 74, lineHeight: 82, marginTop: 4 },
  setupMode: { color: colors.setupGold, fontFamily: fontFamily.semibold, fontSize: 28 },
  setupSummary: { width: 580, marginTop: 18, paddingVertical: 14, borderTopColor: colors.setupMuted, borderBottomColor: colors.setupMuted, borderTopWidth: borderWidth.hairline, borderBottomWidth: borderWidth.hairline, gap: 8, opacity: 0.85 },
  setupSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 24 },
  setupSummaryLabel: { color: colors.setupMuted, fontFamily: fontFamily.medium, fontSize: 20 },
  setupSummaryValue: { color: colors.setupText, fontFamily: fontFamily.semibold, fontSize: 20, maxWidth: 340, textAlign: 'right' },
  setupHostLine: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16 },
  setupHostCaption: { color: colors.setupMuted, fontFamily: fontFamily.semibold, fontSize: minBodyFontSize.tv, letterSpacing: 2 },
  setupHostName: { color: colors.setupText, fontFamily: fontFamily.semibold, fontSize: 24 },
  setupCount: { color: colors.setupGold, fontFamily: fontFamily.bold, fontSize: 28, marginLeft: 'auto' },
  setupRoster: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2, maxWidth: 560 },
  setupRight: { width: 340, alignItems: 'center', justifyContent: 'center', gap: 22, marginRight: 20 },
  joinCard: { width: 300, alignItems: 'center', gap: 14, padding: 22, backgroundColor: colors.setupSurface, borderRadius: radius.card },
  joinCardEyebrow: { color: colors.ink, fontFamily: fontFamily.semibold, fontSize: minBodyFontSize.tv, letterSpacing: 2, textAlign: 'center' },
  joinCode: { color: colors.ink, fontFamily: fontFamily.bold, fontSize: 45, letterSpacing: 8, marginRight: -8 },
  joinHint: { color: colors.mutedText, fontFamily: fontFamily.medium, fontSize: minBodyFontSize.tv, lineHeight: 20, textAlign: 'center' },
  joinPill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.setupWash, borderColor: colors.setupMuted, borderWidth: borderWidth.hairline, borderRadius: radius.pill },
  joinPillText: { color: colors.setupText, fontFamily: fontFamily.medium, fontSize: minBodyFontSize.tv },
});
