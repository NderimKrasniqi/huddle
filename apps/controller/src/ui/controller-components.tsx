import { colors, elevation, type IconName } from '@huddle/ui';
import { Icon, Surface, Wordmark } from '@huddle/ui/native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { controllerStyles as styles } from './controller-styles';

export function SeatedHeader({ trailing }: { readonly trailing: ReactNode }) {
  return (
    <View style={styles.seatedHeader}>
      <Wordmark height={20} />
      {trailing}
    </View>
  );
}

/** The `ROOM CODE` label and its letters, at the far end of the room's title row. */

export function RoomCodeChip({ code }: { readonly code: string }) {
  return (
    <View style={styles.roomCode}>
      <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
      <View style={styles.roomCodeLetters}>
        {[...code].map((letter, position) => (
          <View key={position} style={styles.roomCodeLetter}>
            <Text style={styles.roomCodeLetterText}>{letter}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function OutlinePill({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={[styles.outlinePill, pressed && styles.buttonPressed]}>
          <Text style={styles.outlinePillText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The orange bar at the foot of a screen: the one thing that screen is for.
 *
 * Every screen in the Controller has exactly one, which is what makes it read
 * as the answer to "and then?" rather than as a button among buttons. The
 * trailing icon is optional and is only ever an arrow — a control that moves
 * the Host to another screen says so, and a control that commits the room does
 * not.
 */

export function PrimaryButton({
  label,
  trailingIcon,
  enabled,
  onPress,
}: {
  readonly label: string;
  readonly trailingIcon?: IconName;
  readonly enabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.stretch}
      disabled={!enabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
    >
      {({ pressed }) => (
        <Surface
          elevation={elevation.phoneCard}
          // Dimming belongs to the whole surface: fading the face alone would
          // leave a solid shadow under a ghosted button.
          style={[[styles.stretch, !enabled && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
          <Text style={styles.buttonLabel}>{label}</Text>
          {trailingIcon === undefined ? null : (
            <Icon name={trailingIcon} size={20} color={colors.inverse} />
          )}
        </Surface>
      )}
    </Pressable>
  );
}
