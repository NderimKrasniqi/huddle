import type { GameSetting } from '@huddle/domain';
import { playroomPhone } from '@huddle/design-tokens';
import {
  PlayroomButton,
  PlayroomSettingIcon,
  PlayroomSheet,
  PlayroomText,
  PlayroomPressable,
} from '@huddle/ui/native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SettingControl } from '../../features/game-picker/settings-choice';
import { setupStyles as styles } from './setup-styles';

/**
 * Counts use a stepper, short lists a segmented control, and long lists a
 * row that opens a sheet.
 */
export function SettingControlView({
  setting,
  control,
  onChoose,
  onOpenSheet,
}: {
  readonly setting: GameSetting;
  readonly control: SettingControl;
  readonly onChoose: (value: string) => void;
  readonly onOpenSheet: () => void;
}) {
  const chosenIndex = Math.max(control.options.findIndex((option) => option.chosen), 0);
  const chosen = control.options[chosenIndex];

  if (setting.icon === 'count' && control.options.length > 1) {
    const previous = control.options[chosenIndex - 1];
    const next = control.options[chosenIndex + 1];
    return (
      <View style={styles.stepper}>
        <PlayroomSettingIcon icon={setting.icon} size={30} />
        <PlayroomText style={[playroomPhone.type.label, styles.flex]}>{control.label}</PlayroomText>
        <StepButton label="−" hint={`Fewer ${control.label.toLowerCase()}`} disabled={previous === undefined} onPress={() => previous && onChoose(previous.value)} testID={`setup-option-${control.key}-fewer`} />
        <PlayroomText style={styles.stepValue} accessibilityLiveRegion="polite">{chosen?.label}</PlayroomText>
        <StepButton label="+" hint={`More ${control.label.toLowerCase()}`} disabled={next === undefined} onPress={() => next && onChoose(next.value)} testID={`setup-option-${control.key}-more`} />
      </View>
    );
  }

  if (control.options.length <= 4) {
    return (
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <PlayroomSettingIcon icon={setting.icon} size={30} />
          <PlayroomText style={playroomPhone.type.label}>{control.label}</PlayroomText>
        </View>
        <View style={styles.segmented}>
          {control.options.map((option) => (
            <Segment
              key={option.value}
              label={option.label}
              selected={option.chosen}
              onPress={() => onChoose(option.value)}
              testID={`setup-option-${control.key}-${option.value}`}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <PlayroomPressable
      onPress={onOpenSheet}
      accessibilityRole="button"
      accessibilityLabel={`${control.label}: ${chosen?.label ?? ''}`}
      accessibilityHint="Opens the options"
      testID={`setup-row-${control.key}`}
      style={styles.row}
    >
      <PlayroomSettingIcon icon={setting.icon} size={30} />
      <PlayroomText style={[playroomPhone.type.label, styles.flex]}>{control.label}</PlayroomText>
      <PlayroomText color="muted" style={playroomPhone.type.body}>{chosen?.label}</PlayroomText>
      <PlayroomText style={styles.chevron}>›</PlayroomText>
    </PlayroomPressable>
  );
}

export function Segment({
  label,
  selected,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  return (
    <PlayroomPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={[styles.segment, selected ? styles.segmentOn : null]}
    >
      <PlayroomText color={selected ? 'ink' : 'muted'} numberOfLines={1} style={playroomPhone.type.caption}>
        {label}
      </PlayroomText>
    </PlayroomPressable>
  );
}

export function StepButton({
  label,
  hint,
  disabled,
  onPress,
  testID,
}: {
  readonly label: string;
  readonly hint: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  return (
    <PlayroomPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[styles.step, disabled ? styles.stepOff : null]}
    >
      <PlayroomText color={disabled ? 'muted' : 'ink'} style={styles.stepLabel}>{label}</PlayroomText>
    </PlayroomPressable>
  );
}

export function OptionSheet({
  setting,
  control,
  onChoose,
  onClose,
}: {
  readonly setting: GameSetting | undefined;
  readonly control: SettingControl;
  readonly onChoose: (value: string) => void;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <PlayroomSheet onClose={onClose} bottomInset={insets.bottom} testID={`setup-sheet-${control.key}`}>
        <View style={styles.blockHead}>
          <PlayroomSettingIcon icon={setting?.icon} size={34} />
          <PlayroomText style={playroomPhone.type.heading}>{control.label}</PlayroomText>
        </View>
        {control.options.map((option) => (
          <PlayroomPressable
            key={option.value}
            onPress={() => onChoose(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: option.chosen }}
            testID={`setup-option-${control.key}-${option.value}`}
            style={[styles.option, option.chosen ? styles.optionOn : null]}
          >
            <PlayroomText style={playroomPhone.type.label}>{option.label}</PlayroomText>
            <View style={[styles.check, option.chosen ? styles.checkOn : null]}>
              {option.chosen ? <View style={styles.tick} /> : null}
            </View>
          </PlayroomPressable>
        ))}
        <PlayroomButton label="Done" onPress={onClose} />
    </PlayroomSheet>
  );
}
