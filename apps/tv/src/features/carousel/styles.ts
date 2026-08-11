import { borderWidth, colors, fontFamily, minBodyFontSize, opacity, radius } from '@huddle/ui';
import { StyleSheet } from 'react-native';
import { roomLayout } from '../room';

const FOOTER_TEXT_LINE = 28;

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // The wordmark's row on the carousel and the game frame — every TV screen
  // except the Room, which needs the mark out of the flow so its title can
  // share the band (`roomWordmark`).
  header: {
    paddingHorizontal: 56,
    paddingTop: roomLayout.headerTop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 36,
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
  },
  // The active dot is an accent pill with an ink border (§6).
  pageDotActive: {
    width: 32,
    backgroundColor: colors.accent,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
  },
  browsingLine: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 22,
    lineHeight: FOOTER_TEXT_LINE,
  },
  carousel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  carouselArrow: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  carouselArrowHidden: {
    opacity: 0,
  },
  // 440×520. This is the TV's focus treatment, which the handoff pins: an
  // orange border at `borderWidth.focus`, and explicitly *not* scale alone —
  // the card is already the largest thing on the screen, so a 1.04 lift reads
  // as nothing from across a room while a 3px orange edge reads immediately.
  focusedCard: {
    width: 440,
    height: 520,
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: borderWidth.focus,
    borderRadius: radius.cardLarge,
  },
  keyArt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
    // The card used to clip this to its own corners. It cannot any more —
    // `overflow: 'hidden'` sets `masksToBounds`, which would clip the card's
    // shadow too — so the art rounds its own top corners instead, inset by the
    // focus border so the curve sits inside the orange rather than under it.
    borderTopLeftRadius: radius.cardLarge - borderWidth.focus,
    borderTopRightRadius: radius.cardLarge - borderWidth.focus,
  },
  cardInfo: {
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderBottomLeftRadius: radius.cardLarge - borderWidth.focus,
    borderBottomRightRadius: radius.cardLarge - borderWidth.focus,
  },
  cardTitle: {
    color: colors.inverse,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 38,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sideCardWrapper: {
    opacity: opacity.carouselSideCard,
    transform: [{ scale: 0.94 }],
  },
  sideCard: {
    width: 300,
    height: 400,
    overflow: 'hidden',
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.cardLarge,
  },
  sideArt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    overflow: 'hidden',
    borderTopLeftRadius: radius.cardLarge,
    borderTopRightRadius: radius.cardLarge,
  },
  sideCardInfo: {
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomLeftRadius: radius.cardLarge,
    borderBottomRightRadius: radius.cardLarge,
  },
  sideCardTitle: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },
  placeholderBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.chip,
    opacity: 0.9,
  },
  placeholderBadgeText: {
    color: colors.inverse,
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    letterSpacing: 1.2,
  },

  // The dots and the line side by side rather than stacked. §6 asks for "page
  // dots + '<Host> is browsing on their phone'" and does not say in which
  // direction, and one row is 28pt of content instead of 56: the footer goes
  // 92 → 64, the card lands at 124→644 with its 10px accent shadow to 654, and
  // the dots sit at 664. Ten points of daylight under the shadow the active dot
  // used to disappear into, with every pinned §6 number left alone — the
  // arithmetic and the two nudges that did not work are in the plan.
  //
  // `justifyContent` is load-bearing rather than decorative: `screen` stretches
  // this footer across the full 1280pt, so a row without it packs the dots and
  // the line against the left edge. `alignItems` stays and changes meaning —
  // it now centres the two on each other's line.
  chip: {
    position: 'relative',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  chipWash: {
    backgroundColor: colors.inverse,
    borderRadius: radius.chip,
    opacity: 0.14,
  },
  chipText: {
    color: colors.inverse,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
  },

  // 300×400 at half opacity and stood back, per §6. The tilt comes from
  // Soft Minimal's own sticker rotation rather than a number invented here.
});
