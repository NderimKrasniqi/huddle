import { borderWidth, colors, fontFamily, radius, semanticStyles } from '@huddle/ui';
import { BottomSheetOptionRow } from '@huddle/ui/kit';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../ui/native';

export type CategoryPickerOption = {
  readonly value: string;
  readonly label: string;
};

/**
 * The prototype's category state is a bottom sheet over the live settings
 * screen. Keeping the sheet here, rather than making it a new Expo route,
 * means the authoritative Convex draft and the settings screen stay mounted
 * while the Host makes a choice.
 */
export function CategoryPickerSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onDismiss,
}: {
  readonly visible: boolean;
  readonly title: string;
  readonly options: readonly CategoryPickerOption[];
  readonly selectedValue: string | undefined;
  readonly onSelect: (value: string) => void;
  readonly onDismiss: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.absoluteFill, styles.scrim]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close category picker"
        />

        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.title}>{title}</Text>

            <View style={styles.options}>
              {options.map((option, index) => (
                <BottomSheetOptionRow
                  key={option.value}
                  label={option.label}
                  selected={option.value === selectedValue}
                  onPress={() => onSelect(option.value)}
                  style={[
                    styles.option,
                    index === options.length - 1 ? undefined : styles.optionRuled,
                  ]}
                />
              ))}
            </View>

            <PrimaryButton label="Done" enabled onPress={onDismiss} />
            <Pressable
              onPress={onDismiss}
              style={styles.cancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel category picker"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = semanticStyles({
  absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: colors.ink,
    opacity: 0.32,
  },
  safeArea: {
    justifyContent: 'flex-end',
  },
  sheet: {
    gap: 14,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.canvas,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  grabber: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 21,
    textAlign: 'center',
  },
  options: {
    overflow: 'hidden',
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.row,
  },
  option: {
    width: '100%',
    minWidth: 0,
    borderWidth: 0,
    borderRadius: 0,
  },
  optionRuled: {
    borderBottomColor: colors.border,
    borderBottomWidth: borderWidth.hairline,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
  },
});
