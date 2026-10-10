import { playroomColors, playroomMotion, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import { StyleSheet } from 'react-native';

const RING = 220;

export const setupStyles = StyleSheet.create({
  thumbSpacer: { flexGrow: 1, minHeight: 8 },
  thumbSpacerBelow: { flexGrow: 0.4 },
  readyName: {
    flexShrink: 1,
  },
  readyPerson: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, backgroundColor: playroomColors.surface },
  // A raised hand reads at a glance: the chip turns the success colour.
  readyPersonUp: { backgroundColor: playroomColors.successSurface },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  summaryValue: { flexShrink: 1, textAlign: 'right', maxWidth: '55%' },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  art: {
    alignSelf: 'center',
    width: '70%',
    aspectRatio: 1.6,
  },
  segmented: {
    flexDirection: 'row',
    gap: 6,
    padding: 5,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.surface,
    borderWidth: 1,
    borderColor: playroomColors.border,
  },
  segment: {
    flex: 1,
    minHeight: playroomPhone.minTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  segmentOn: {
    backgroundColor: playroomColors.lavender,
    borderWidth: 1,
    borderColor: playroomColors.border,
  },
  settings: {
    gap: 14,
  },
  block: {
    gap: 8,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.surface,
    borderWidth: 1,
    borderColor: playroomColors.border,
  },
  step: {
    width: playroomPhone.minTarget,
    height: playroomPhone.minTarget,
    borderRadius: 14,
    backgroundColor: playroomColors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: {
    backgroundColor: playroomColors.disabled,
  },
  stepLabel: {
    fontSize: 26,
    lineHeight: 30,
  },
  stepValue: {
    ...playroomPhone.type.title,
    minWidth: 34,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: playroomPhone.minTarget + 8,
    paddingHorizontal: 12,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.surface,
    borderWidth: 1,
    borderColor: playroomColors.border,
  },
  chevron: {
    fontSize: 24,
    lineHeight: 26,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: playroomPhone.minTarget,
    paddingHorizontal: 14,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.surface,
  },
  optionOn: {
    backgroundColor: playroomColors.lavender,
    borderWidth: 1,
    borderColor: playroomColors.border,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: playroomColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    borderColor: playroomColors.ink,
    backgroundColor: playroomColors.ink,
  },
  tick: {
    width: 6,
    height: 11,
    marginTop: -2,
    borderColor: playroomColors.surface,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
  },
  readyContext: {
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  presetCard: { alignItems: 'center', gap: 6 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  summary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.surface,
    borderWidth: 1,
    borderColor: playroomColors.border,
  },
  raise: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  raisePressed: {
    transform: [{ scale: playroomMotion.pressScale }],
  },
  disc: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: playroomColors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discUp: {
    backgroundColor: playroomColors.successSurface,
    borderWidth: 5,
    borderColor: playroomColors.success,
  },
  hand: {
    width: 76,
    height: 76,
  },
  waiting: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  countdown: {
    alignItems: 'stretch',
  },
  ring: {
    alignSelf: 'center',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 12,
    borderColor: playroomColors.orange,
    backgroundColor: playroomColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  number: {
    ...playroomPhone.type.countdown,
  },
  go: {
    ...playroomPhone.type.display,
    color: playroomColors.orange,
  },
});
