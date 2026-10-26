import { playroomColors, playroomPhone, playroomRadii, playroomScrim } from '@huddle/design-tokens';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

export interface PlayroomSheetProps {
  readonly onClose: () => void;
  readonly bottomInset: number;
  readonly dismissOnScrim?: boolean;
  readonly testID?: string;
  readonly children: ReactNode;
}

export function PlayroomSheet({ onClose, bottomInset, dismissOnScrim = true, testID, children }: PlayroomSheetProps) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal testID={testID}>
      <View style={styles.scrim}>
        {dismissOnScrim ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        ) : null}
        <View style={[styles.sheet, { paddingBottom: bottomInset + playroomPhone.gutter }]}>
          <View style={styles.grab} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: playroomScrim,
  },
  sheet: {
    gap: 12,
    paddingHorizontal: playroomPhone.gutter,
    paddingTop: 12,
    borderTopLeftRadius: playroomRadii.card,
    borderTopRightRadius: playroomRadii.card,
    backgroundColor: playroomColors.canvas,
  },
  grab: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: playroomColors.border,
    marginBottom: 4,
  },
});
