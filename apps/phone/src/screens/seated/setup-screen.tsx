import {
  settingOptionLabel,
  settingSummaryText,
  type AvatarId,
  type GameModule,
  type GameSettings,
  type GameSettingsMode,
} from '@huddle/domain';
import { playroomPhone } from '@huddle/design-tokens';
import {
  PlayroomGameCover,
  PlayroomAvatar,
  PlayroomButton,
  PlayroomHeading,
  PlayroomSettingIcon,
  PlayroomText,
  PlayroomPill,
} from '@huddle/ui/native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';

import type { RosterSeat } from '../../features/room';
import { settingsControls } from '../../features/game-picker/settings-choice';
import { setupModeLabel } from '../seated-phone-model';
import type { BusyAction } from '../use-seated-room';
import { HostSteps } from './host-steps';
import { PhoneCard, PhoneFrame, PhoneNotice, PhoneTopBar } from './phone-frame';
import { OptionSheet, Segment, SettingControlView } from './setup-controls';
import { CountdownScreen, ReadyScreen } from './setup-ready';
import { setupStyles as styles } from './setup-styles';

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

  function chooseMode(mode: GameSettingsMode) {
    void Haptics.selectionAsync();
    const preset = presentation?.presets?.find((candidate) => candidate.mode === mode);
    onConfigure(mode, mode === 'custom' ? customSettings() : preset?.settings ?? defaults());
  }

  function choose(key: string, value: string) {
    void Haptics.selectionAsync();
    onConfigure('custom', { ...customSettings(), [key]: value });
  }

  function defaults(): GameSettings {
    return Object.fromEntries(
      module.settingsSchema.map((setting) => [setting.key, settings[setting.key] ?? setting.defaultValue]),
    );
  }

  /** Custom settings keep to the keys and options the game allows in Custom. */
  function customSettings(): GameSettings {
    return Object.fromEntries(
      module.settingsSchema.map((setting) => {
        const visible = presentation?.customSettingKeys === undefined || presentation.customSettingKeys.includes(setting.key);
        const allowed = presentation?.customOptions?.[setting.key];
        const options = allowed === undefined ? setting.options : setting.options.filter((option) => allowed.includes(option.value));
        const current = visible ? settings[setting.key] : undefined;
        const selected =
          current !== undefined && options.some((option) => option.value === current)
            ? current
            : options[0]?.value ?? setting.defaultValue;
        return [setting.key, selected];
      }),
    );
  }

  const sheetControl = controls.find((control) => control.key === sheet);

  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-setup"
      footer={
        <>
        <HostSteps current="Setup" />
        <PlayroomButton label="Ready check" onPress={onFinalize} busy={busy === 'finalize'} accessibilityLabel="Lock game setup" testID="lock-game-setup" />
        </>
      }
    >
      <PhoneTopBar back={{ label: 'Room', onPress: onCancel, testID: 'setup-nav-back' }} you={you} />
      <PlayroomHeading type={playroomPhone.type.heading}>{`Set up ${module.metadata.title}`}</PlayroomHeading>
      <PlayroomGameCover gameId={module.metadata.id} height={150} />
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
      {setup.mode !== 'custom' ? (
        // A preset reads as one sentence; changing it is one tap away, not five rows.
        <PhoneCard style={styles.presetCard}>
          <PlayroomText style={playroomPhone.type.title}>{presentation?.presets?.find((preset) => preset.mode === setup.mode)?.label ?? setupModeLabel(setup.mode)}</PlayroomText>
          {/* One chip per setting, like the TV: scannable, never a sentence broken mid-phrase. */}
          <View style={styles.summaryChips} accessible accessibilityLabel={module.settingsSchema.map((setting) => settingSummaryText(setting, settings[setting.key] ?? setting.defaultValue)).join(', ')}>
            {module.settingsSchema.map((setting) => (
              <PlayroomPill key={setting.key} textStyle={playroomPhone.type.caption}>
                {settingSummaryText(setting, settings[setting.key] ?? setting.defaultValue)}
              </PlayroomPill>
            ))}
          </View>
          <PlayroomButton label="Customize" variant="link" onPress={() => chooseMode('custom')} accessibilityLabel="Customize settings" testID="setup-customize" />
        </PhoneCard>
      ) : <View style={styles.settings}>
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
      </View>}
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

function GuestSetup({ module, setup, roster, you, onLeave }: SetupScreenProps) {
  const host = roster.find((seat) => seat.host);
  return (
    <PhoneFrame
      avatarId={you?.avatarId}
      testID="phone-game-setup"
      footer={<PlayroomButton label="Leave room" variant="link" onPress={onLeave} accessibilityLabel="Leave room" testID="setup-leave" />}
    >
      <PhoneTopBar you={you} />
      <PlayroomHeading type={playroomPhone.type.heading}>Setting up</PlayroomHeading>
      <PlayroomGameCover gameId={module.metadata.id} height={150} />
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
  return <View style={styles.summary} testID="setup-ready-summary">
    {module.settingsSchema.map((setting) => <View key={setting.key} style={styles.summaryRow}>
      <PlayroomSettingIcon icon={setting.icon} size={26} />
      <PlayroomText color="muted" style={[playroomPhone.type.caption, styles.flex]}>{setting.label}</PlayroomText>
      <PlayroomText style={[playroomPhone.type.label, styles.summaryValue]}>{settingOptionLabel(setting, settings[setting.key])}</PlayroomText>
    </View>)}
  </View>;
}
