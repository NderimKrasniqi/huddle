import { playroomColors, playroomPhone } from '@huddle/design-tokens';
import { PlayroomText } from '@huddle/ui/native';
import { StyleSheet, View } from 'react-native';

const STEPS = ['Room', 'Game', 'Setup', 'Ready'] as const;
export type HostStep = (typeof STEPS)[number];

/**
 * Where the host is on the way to a game, shown above their main action on
 * every screen of the flow, so the next tap never comes as a surprise.
 */
export function HostSteps({ current }: { readonly current: HostStep }) {
  const at = STEPS.indexOf(current);
  return (
    <View style={styles.row} accessible accessibilityLabel={`Step ${at + 1} of ${STEPS.length}: ${current}`} testID="host-steps">
      {STEPS.map((step, index) => (
        <View key={step} style={styles.step}>
          {index > 0 ? <View style={[styles.line, index <= at ? styles.lineDone : null]} /> : null}
          <View style={[styles.dot, index < at ? styles.dotDone : null, index === at ? styles.dotNow : null]} />
          <PlayroomText color={index === at ? 'ink' : 'muted'} style={[playroomPhone.type.caption, index === at ? styles.now : null]} accessibilityElementsHidden>
            {step}
          </PlayroomText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  line: { width: 14, height: 2, borderRadius: 1, backgroundColor: playroomColors.border },
  lineDone: { backgroundColor: playroomColors.orange },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: playroomColors.border },
  dotDone: { backgroundColor: playroomColors.orange },
  dotNow: { width: 10, height: 10, borderRadius: 5, backgroundColor: playroomColors.orange },
  now: { fontFamily: playroomPhone.type.title.fontFamily },
});
