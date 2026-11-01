import { playroomPhone } from '@huddle/design-tokens';
import { PlayroomButton, PlayroomSheet, PlayroomText } from '@huddle/ui/native';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BusyAction, Confirmation } from '../use-room-action';
import { PhoneNotice } from './phone-frame';

export function ConfirmationSheet({
  confirmation,
  busy,
  failure,
  onCancel,
}: {
  readonly confirmation: Confirmation | undefined;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (confirmation === undefined) return null;
  return (
    <PlayroomSheet onClose={onCancel} bottomInset={insets.bottom} dismissOnScrim={false} testID="heartbeat-confirmation-modal">
      <PlayroomText accessibilityRole="header" style={[playroomPhone.type.heading, styles.center]}>
        {confirmation.title}
      </PlayroomText>
      <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
        {confirmation.message}
      </PlayroomText>
      {failure ? <PhoneNotice testID="confirmation-error">{failure}</PhoneNotice> : null}
      <PlayroomButton
        label={confirmation.confirmLabel}
        variant={confirmation.destructive ? 'destructive' : 'primary'}
        onPress={confirmation.onConfirm}
        busy={busy === confirmation.action}
        accessibilityLabel={confirmation.confirmLabel}
        testID="confirmation-confirm"
      />
      <PlayroomButton label="Cancel" variant="secondary" onPress={onCancel} disabled={busy === confirmation.action} accessibilityLabel="Cancel" testID="confirmation-cancel" />
    </PlayroomSheet>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
});
