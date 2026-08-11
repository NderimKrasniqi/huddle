import type { ReactNode } from 'react';
import { Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HuddleIcon } from './icon';
import { huddleUIKitColors, huddleUIKitRadius, huddleUIKitTypography } from './theme';

export function OnlineDot({ size = 12 }: { readonly size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Online"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: huddleUIKitColors.success,
      }}
    />
  );
}

export function SelectedBadge({ label = 'SELECTED' }: { readonly label?: string }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: huddleUIKitColors.orange,
        borderRadius: huddleUIKitRadius.sm,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: huddleUIKitColors.surface,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: huddleUIKitColors.orange,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HuddleIcon name="check" size={13} color={huddleUIKitColors.surface} strokeWidth={3} />
      </View>
      <Text
        style={{
          color: huddleUIKitColors.orange,
          fontFamily: huddleUIKitTypography.bold,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export type StatusPillVariant = 'active' | 'host' | 'away';

export function StatusPill({ variant }: { readonly variant: StatusPillVariant }) {
  const config = {
    active: {
      text: 'ACTIVE',
      foreground: huddleUIKitColors.success,
      background: huddleUIKitColors.activeBackground,
    },
    host: {
      text: 'HOST',
      foreground: huddleUIKitColors.orange,
      background: huddleUIKitColors.hostBackground,
    },
    away: {
      text: 'AWAY',
      foreground: huddleUIKitColors.away,
      background: huddleUIKitColors.awayBackground,
    },
  }[variant];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={config.text}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: huddleUIKitRadius.pill,
        backgroundColor: config.background,
      }}
    >
      <Text
        style={{
          color: config.foreground,
          fontFamily: huddleUIKitTypography.semibold,
          fontSize: 13,
        }}
      >
        {config.text}
      </Text>
    </View>
  );
}

export type StatusStripVariant = 'info' | 'success';

export function StatusStrip({
  variant = 'info',
  children,
  style,
}: {
  readonly variant?: StatusStripVariant;
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
}) {
  const success = variant === 'success';

  return (
    <View
      accessibilityRole="alert"
      style={[
        {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 11,
          borderRadius: huddleUIKitRadius.sm,
          backgroundColor: success
            ? huddleUIKitColors.successBackground
            : huddleUIKitColors.infoBackground,
          borderWidth: success ? 0 : 1,
          borderColor: huddleUIKitColors.border,
        },
        style,
      ]}
    >
      {success ? <OnlineDot size={13} /> : <HuddleIcon name="info" size={20} />}
      <Text
        style={{
          flex: 1,
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: 14,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function PhoneBrowsingHelper({ name }: { readonly name: string }) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${name} is browsing on their phone`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderRadius: huddleUIKitRadius.sm,
        backgroundColor: huddleUIKitColors.infoBackground,
        borderWidth: 1,
        borderColor: huddleUIKitColors.border,
      }}
    >
      <HuddleIcon name="phone" size={Platform.isTV ? 34 : 24} />
      <Text
        style={{
          color: huddleUIKitColors.textPrimary,
          fontFamily: huddleUIKitTypography.medium,
          fontSize: Platform.isTV ? 20 : 16,
        }}
      >
        {name} is browsing on their phone.
      </Text>
    </View>
  );
}
