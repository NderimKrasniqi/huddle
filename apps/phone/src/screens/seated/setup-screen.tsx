import {
  COUNTDOWN_MS,
  settingSummaryText,
  type AvatarId,
  type GameModule,
  type GameSetting,
  type GameSettings,
  type GameSettingsMode,
} from '@huddle/domain';
import { playroomAvatarCircles, playroomColors, playroomMotion, playroomPhone, playroomRadii } from '@huddle/design-tokens';
import {
  PLAYROOM_ARTWORK,
  PlayroomAvatar,
  PlayroomButton,
  PlayroomHeading,
  PlayroomPill,
  PlayroomSettingIcon,
  PlayroomText,
  playroomGameArt,
} from '@huddle/ui/native';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RosterSeat } from '../../features/room';
import { settingsControls, type SettingControl } from '../../features/game-picker/settings-choice';
import { setupModeLabel, setupReadiness } from '../seated-phone-model';
import type { BusyAction } from '../use-seated-room';
import { PhoneCard, PhoneFrame, PhoneNotice, PhoneTopBar } from './phone-frame';

export type SetupScreenProps = {
  readonly module: GameModule;
  readonly setup: {
    readonly gameId: string;
    readonly settings: Record<string, string>;
    readonly mode: GameSettingsMode;
    readonly stage: 'configuring' | 'ready' | 'countdown';
    readonly readyPlayerIds: readonly string[];
    readonly countdownEndsAt?: number;
  };
  readonly roster: readonly RosterSeat[];
  readonly playerId: string;
  readonly you?: { readonly nickname: string; readonly avatarId: AvatarId };
  readonly youAreHost: boolean;
  readonly busy: BusyAction;
  readonly failure?: string;
  readonly onConfigure: (mode: GameSettingsMode, settings: GameSettings) => void;
  readonly onFinalize: () => void;
  readonly onReopen: () => void;
  readonly onCancel: () => void;
  readonly onReady: () => void;
  readonly onStart: () => void;
  readonly onStop?: () => void;
  readonly onLeave: () => void;
};

/** The pre-game phone surface, following the server's setup stage. */
export function SetupScreen(props: SetupScreenProps) {
  const { setup } = props;
  if (setup.stage === 'countdown' && setup.countdownEndsAt !== undefined) {
    return <CountdownScreen {...props} countdownEndsAt={setup.countdownEndsAt} />;
  }
  if (setup.stage === 'configuring') {
    return props.youAreHost ? <HostSetup {...props} /> : <GuestSetup {...props} />;
  }
  return <ReadyScreen {...props} />;
}

const MODES = ['quick', 'standard', 'custom'] as const;

function HostSetup({ module, setup, you, busy, failure, onConfigure, onFinalize, onCancel }: SetupScreenProps) {
  const presentation = module.settingsPresentation;
  const settings = setup.settings;
  const controls = settingsControls(module.settingsSchema, setup.gameId, { gameId: setup.gameId, settings }, presentation);
  const [sheet, setSheet] = useState<string>();
  const art = playroomGameArt(module.metadata.id);

  function chooseMode(mode: GameSettingsMode) {
    void Haptics.selectionAsync();
    const preset = presentation?.presets?.find((candidate) => candidate.mode === mode);
    onConfigure(mode, mode === 'custom' ? current() : preset?.settings ?? current());
  }

  function choose(key: string, value: string) {
    void Haptics.selectionAsync();
    onConfigure('custom', { ...current(), [key]: value });
  }

  function current(): GameSettings {
    return Object.fromEntries(
      module.settingsSchema.map((setting) => [setting.key, settings[setting.key] ?? setting.defaultValue]),
    );
  }

  const sheetControl = controls.find((control) => control.key === sheet);

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-setup"
      footer={
        <PlayroomButton label="Lock settings" bursts onPress={onFinalize} busy={busy === 'finalize'} accessibilityLabel="Lock game setup" testID="lock-game-setup" />
      }
    >
      <PhoneTopBar back={{ label: 'Games', onPress: onCancel, testID: 'setup-nav-back' }} you={you} />
      <PlayroomHeading type={playroomPhone.type.heading}>{`Set up ${module.metadata.title}`}</PlayroomHeading>
      {art ? <Image source={art} style={styles.art} resizeMode="contain" accessible={false} /> : null}
      <View style={styles.segmented} accessibilityRole="tablist">
        {MODES.map((mode) => (
          <Segment
            key={mode}
            label={setupModeLabel(mode)}
            selected={setup.mode === mode}
            onPress={() => chooseMode(mode)}
            testID={`setup-mode-${mode}`}
          />
        ))}
      </View>
      <View style={styles.settings}>
        {controls.map((control) => {
          const setting = module.settingsSchema.find((candidate) => candidate.key === control.key);
          if (setting === undefined) return null;
          return (
            <SettingControlView
              key={control.key}
              setting={setting}
              control={control}
              onChoose={(value) => choose(control.key, value)}
              onOpenSheet={() => setSheet(control.key)}
            />
          );
        })}
      </View>
      {failure ? <PhoneNotice testID="setup-error">{failure}</PhoneNotice> : null}
      {sheetControl ? (
        <OptionSheet
          setting={module.settingsSchema.find((candidate) => candidate.key === sheetControl.key)}
          control={sheetControl}
          onChoose={(value) => choose(sheetControl.key, value)}
          onClose={() => setSheet(undefined)}
        />
      ) : null}
    </PhoneFrame>
  );
}

/**
 * Counts use a stepper, short lists a segmented control, and long lists a
 * row that opens a sheet.
 */
function SettingControlView({
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
    <Pressable
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
    </Pressable>
  );
}

function Segment({
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
    <Pressable
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
    </Pressable>
  );
}

function StepButton({
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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[styles.step, disabled ? styles.stepOff : null]}
    >
      <PlayroomText color={disabled ? 'muted' : 'ink'} style={styles.stepLabel}>{label}</PlayroomText>
    </Pressable>
  );
}

function OptionSheet({
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
    <Modal visible transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal testID={`setup-sheet-${control.key}`}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grab} />
        <View style={styles.blockHead}>
          <PlayroomSettingIcon icon={setting?.icon} size={34} />
          <PlayroomText style={playroomPhone.type.heading}>{control.label}</PlayroomText>
        </View>
        {control.options.map((option) => (
          <Pressable
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
          </Pressable>
        ))}
        <PlayroomButton label="Done" onPress={onClose} />
      </View>
    </Modal>
  );
}

function GuestSetup({ module, setup, roster, you, onLeave }: SetupScreenProps) {
  const host = roster.find((seat) => seat.host);
  const art = playroomGameArt(module.metadata.id);
  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-setup"
      footer={<PlayroomButton label="Leave room" variant="link" onPress={onLeave} accessibilityLabel="Leave room" testID="setup-leave" />}
    >
      <PhoneTopBar you={you} />
      <PlayroomHeading type={playroomPhone.type.heading}>Setting up</PlayroomHeading>
      {art ? <Image source={art} style={styles.art} resizeMode="contain" accessible={false} /> : null}
      <PlayroomText style={[playroomPhone.type.hero, styles.center]}>{module.metadata.title}</PlayroomText>
      {host ? (
        <PhoneCard style={styles.infoCard}>
          <PlayroomAvatar avatarId={host.avatar} size={52} host />
          <View style={styles.flex}>
            <PlayroomText style={playroomPhone.type.title}>{`${host.nickname} is choosing the settings`}</PlayroomText>
            <PlayroomText color="muted" style={playroomPhone.type.body}>They show up on the TV as they change</PlayroomText>
          </View>
        </PhoneCard>
      ) : null}
      <Summary module={module} settings={setup.settings} />
    </PhoneFrame>
  );
}

function Summary({ module, settings }: { readonly module: GameModule; readonly settings: GameSettings }) {
  return (
    <View style={styles.summary} testID="setup-ready-summary">
      <PlayroomText style={[playroomPhone.type.label, styles.center]}>
        {module.settingsSchema.map((setting) => settingSummaryText(setting, settings[setting.key])).join(' · ')}
      </PlayroomText>
    </View>
  );
}

/** Everyone raises a hand; the host starts once every hand is up. */
function ReadyScreen({
  module,
  setup,
  roster,
  playerId,
  you,
  youAreHost,
  busy,
  failure,
  onReopen,
  onReady,
  onStart,
  onLeave,
}: SetupScreenProps) {
  const { allReady, canStart, readyCount, currentReady } = setupReadiness({
    stage: setup.stage,
    playerRange: module.metadata.playerRange,
    roster,
    readyPlayerIds: setup.readyPlayerIds,
    playerId,
  });
  const awayCount = roster.filter((seat) => seat.away).length;
  const countInRange = roster.length >= module.metadata.playerRange.min && roster.length <= module.metadata.playerRange.max;
  const status =
    awayCount > 0
      ? `${awayCount} player${awayCount === 1 ? '' : 's'} away. Waiting for them to reconnect.`
      : !countInRange
        ? `Need ${module.metadata.playerRange.min}–${module.metadata.playerRange.max} players to start.`
        : allReady
          ? 'Everyone is ready. The Host can start.'
          : 'Everyone raises a hand to start.';
  const waiting = roster.filter((seat) => !setup.readyPlayerIds.includes(seat.playerId) || seat.away);

  function raise() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReady();
  }

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-setup"
      footer={
        youAreHost ? (
          <>
            <PlayroomButton
              label={canStart ? `Start ${module.metadata.title}` : `Waiting for ${Math.max(roster.length - readyCount, 1)} more`}
              bursts
              onPress={onStart}
              busy={busy === 'start'}
              disabled={!canStart}
              accessibilityLabel={`Start ${module.metadata.title}`}
              testID="start-game"
            />
            <PlayroomButton label="Edit setup" variant="link" onPress={onReopen} busy={busy === 'reopen'} accessibilityLabel="Reopen game setup" testID="reopen-game-setup" />
          </>
        ) : (
          <PlayroomButton label="Leave room" variant="link" onPress={onLeave} accessibilityLabel="Leave room" testID="setup-leave" />
        )
      }
    >
      <PhoneTopBar back={youAreHost ? { label: 'Setup', onPress: onReopen, testID: 'setup-nav-back' } : undefined} you={you} />
      <PlayroomHeading type={playroomPhone.type.heading}>{currentReady ? 'You’re all set!' : `Ready for ${module.metadata.title}?`}</PlayroomHeading>
      <Summary module={module} settings={setup.settings} />
      <Pressable
        onPress={raise}
        disabled={busy === 'ready'}
        accessibilityRole="button"
        accessibilityLabel={currentReady ? 'Mark not ready' : 'Mark ready'}
        accessibilityState={{ selected: currentReady, disabled: busy === 'ready' }}
        testID="toggle-game-ready"
        style={({ pressed }) => [styles.raise, pressed ? styles.raisePressed : null]}
      >
        <View style={[styles.disc, currentReady ? styles.discUp : null]}>
          <Image
            source={PLAYROOM_ARTWORK.props.hand}
            style={[styles.hand, currentReady ? { tintColor: playroomColors.success } : null]}
            resizeMode="contain"
            accessible={false}
          />
        </View>
        <PlayroomText style={playroomPhone.type.heading}>{currentReady ? 'Hand’s up!' : 'Raise your hand'}</PlayroomText>
      </Pressable>
      <PlayroomPill textStyle={playroomPhone.type.caption}>{`${readyCount} of ${roster.length} hands up`}</PlayroomPill>
      <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>
        {status}
      </PlayroomText>
      {youAreHost && waiting.length > 0 ? (
        <View style={styles.waiting} accessible accessibilityLabel={`Still waiting for ${waiting.map((seat) => seat.nickname).join(', ')}`}>
          {waiting.map((seat) => (
            <PlayroomAvatar key={seat.playerId} avatarId={seat.avatar} size={36} away={seat.away} />
          ))}
        </View>
      ) : null}
      {failure ? <PhoneNotice testID="setup-error">{failure}</PhoneNotice> : null}
    </PhoneFrame>
  );
}

/**
 * The countdown on the phone: the same seconds as the TV, a haptic tick and
 * a flash of your colour each second, and a way to stop it.
 */
function CountdownScreen({
  module,
  you,
  youAreHost,
  busy,
  failure,
  onReady,
  onStop,
  countdownEndsAt,
}: SetupScreenProps & { readonly countdownEndsAt: number }) {
  const seconds = useSecondsLeft(countdownEndsAt);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (seconds <= 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flash.set(1);
    flash.set(withTiming(0, { duration: playroomMotion.highlight }));
  }, [flash, seconds]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-countdown"
      footer={
        <PlayroomButton
          label={youAreHost ? 'Stop the countdown' : 'Wait, I’m not ready'}
          variant="link"
          onPress={youAreHost && onStop ? onStop : onReady}
          busy={busy === 'stop' || busy === 'ready'}
          testID="stop-countdown"
        />
      }
      contentStyle={styles.countdown}
    >
      {you ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: playroomAvatarCircles[you.avatarId] }, flashStyle]}
        />
      ) : null}
      <PhoneTopBar you={you} />
      <View style={styles.flex} />
      <PlayroomHeading type={playroomPhone.type.heading}>Get ready!</PlayroomHeading>
      <PlayroomText color="muted" style={[playroomPhone.type.body, styles.center]}>{`${module.metadata.title} starts in`}</PlayroomText>
      <View style={styles.ring} accessible accessibilityLabel={seconds > 0 ? `${seconds}` : 'Go'} accessibilityLiveRegion="polite">
        <PlayroomText style={seconds > 0 ? styles.number : styles.go}>{seconds > 0 ? String(seconds) : 'Go!'}</PlayroomText>
      </View>
      <PlayroomText style={[playroomPhone.type.title, styles.center]}>Eyes on the TV!</PlayroomText>
      {failure ? <PhoneNotice testID="setup-error">{failure}</PhoneNotice> : null}
      <View style={styles.flex} />
    </PhoneFrame>
  );
}

/** Whole seconds until the deadline on this phone's clock, 0 once it passes. */
function useSecondsLeft(endsAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [endsAt]);
  const left = Math.ceil((endsAt - now) / playroomMotion.tick);
  return Math.min(Math.max(left, 0), Math.ceil(COUNTDOWN_MS / playroomMotion.tick));
}

const RING = 220;

const styles = StyleSheet.create({
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
    borderWidth: 1.5,
    borderColor: playroomColors.border,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  segmentOn: {
    backgroundColor: playroomColors.lavender,
    borderWidth: 2,
    borderColor: playroomColors.ink,
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
    borderWidth: 1.5,
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
    borderWidth: 1.5,
    borderColor: playroomColors.border,
  },
  chevron: {
    fontSize: 24,
    lineHeight: 26,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(45, 11, 78, 0.35)',
  },
  sheet: {
    gap: 10,
    paddingHorizontal: playroomPhone.gutter,
    paddingTop: 10,
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
    marginBottom: 6,
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
    borderWidth: 2,
    borderColor: playroomColors.ink,
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: playroomColors.lavender,
  },
  summary: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: playroomRadii.input,
    backgroundColor: playroomColors.surface,
    borderWidth: 1.5,
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
    fontFamily: playroomPhone.type.hero.fontFamily,
    fontSize: 120,
    lineHeight: 130,
  },
  go: {
    fontFamily: playroomPhone.type.hero.fontFamily,
    fontSize: 64,
    lineHeight: 72,
    color: playroomColors.orange,
  },
});
