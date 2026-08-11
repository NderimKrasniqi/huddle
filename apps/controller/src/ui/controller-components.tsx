import { colors, elevation, type IconName } from '@huddle/ui';
import { Icon, LoadingIndicator, Surface } from '@huddle/ui/native';
import { HuddleLogo } from '@huddle/ui/kit';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { controllerStyles as styles } from './controller-styles';

export function SeatedHeader({ trailing }: { readonly trailing: ReactNode }) {
  return (
    <View style={styles.seatedHeader}>
      <HuddleLogo size={20} />
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
  loading = false,
  onPress,
}: {
  readonly label: string;
  readonly trailingIcon?: IconName;
  readonly enabled: boolean;
  readonly loading?: boolean;
  readonly onPress: () => void;
}) {
  const pressable = enabled && !loading;

  return (
    <Pressable
      style={styles.stretch}
      disabled={!pressable}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !pressable, busy: loading }}
    >
      {({ pressed }) => (
        <Surface
          elevation={elevation.phoneCard}
          // Dimming belongs to the whole surface: fading the face alone would
          // leave a solid shadow under a ghosted button.
          style={[[styles.stretch, !enabled && styles.buttonUnavailable], [styles.button, pressed && styles.buttonPressed]]}>
          {loading ? (
            <LoadingIndicator size="small" color={colors.inverse} label={label} />
          ) : null}
          <Text style={styles.buttonLabel}>{label}</Text>
          {trailingIcon === undefined || loading ? null : (
            <Icon name={trailingIcon} size={20} color={colors.inverse} />
          )}
        </Surface>
      )}
    </Pressable>
  );
}
