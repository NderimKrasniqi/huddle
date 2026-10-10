import { playroomColors, playroomPhone, playroomRadii, playroomShadows, playroomSpacing, playroomTv } from '@huddle/design-tokens';
import { ActivityIndicator, Platform, StyleSheet, View, type TextStyle } from 'react-native';

import { PlayroomText } from './playroom-text';

export type StatusSurfaceVariant = 'loading' | 'error';

export type StatusSurfaceProps = {
  readonly title: string;
  readonly message?: string;
  readonly variant?: StatusSurfaceVariant;
  readonly platform?: 'phone' | 'tv';
  readonly systemFont?: boolean;
  readonly testID?: string;
};

const systemFace: TextStyle = { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: undefined }) };

export function StatusSurface({ title, message, variant = 'loading', platform = 'phone', systemFont = false, testID }: StatusSurfaceProps) {
  const type = platform === 'tv' ? playroomTv.type : playroomPhone.type;
  const face = systemFont ? systemFace : null;
  return (
    <View style={styles.screen} testID={testID} focusable={false}>
      <View
        style={[styles.card, platform === 'tv' ? styles.cardTv : null]}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={[title, message].filter(Boolean).join('. ')}
        focusable={false}
      >
        {variant === 'loading' ? (
          <ActivityIndicator size="large" color={playroomColors.orange} />
        ) : (
          <View style={styles.mark}>
            <PlayroomText color="surface" style={[type.heading, face]}>!</PlayroomText>
          </View>
        )}
        <PlayroomText style={[type.heading, styles.center, face]}>{title}</PlayroomText>
        {message ? <PlayroomText color="muted" style={[type.body, styles.center, face]}>{message}</PlayroomText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: playroomSpacing[5],
    backgroundColor: playroomColors.canvas,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    alignItems: 'center',
    gap: playroomSpacing[4],
    padding: playroomSpacing[5],
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  cardTv: {
    maxWidth: 1100,
    padding: playroomSpacing[7],
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: playroomColors.danger,
  },
  center: {
    textAlign: 'center',
  },
});
