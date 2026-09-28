import type { GameSettingsSchema } from '@huddle/domain';
import { playroomColors, playroomMotion, playroomRadii, playroomShadows, playroomTv } from '@huddle/design-tokens';
import {
  PlayroomAvatar,
  PlayroomHeading,
  PlayroomSettingIcon,
  PlayroomText,
  PlayroomTvStage,
  playroomGameArt,
} from '@huddle/ui/native';
import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { TvCountdownScreen } from './game-countdown-screen';
import {
  tvHostCopy,
  tvModeLabel,
  visibleTvSetupSettings,
  type TvGamePlayer,
  type TvSetupSetting,
  type TvSetupSettings,
} from './game-flow-model';
import { TvReadyCheckScreen } from './game-ready-screen';
import { TvPlayroomFrame, TvRosterRow } from './playroom-frame';

export type TvGameSetupScreenProps = {
  readonly gameId: string;
  readonly gameTitle?: string;
  readonly hostName?: string;
  readonly mode?: string;
  readonly settings?: TvSetupSettings;
  readonly settingsSchema?: GameSettingsSchema;
  readonly playerRange?: { readonly min: number; readonly max: number };
  readonly players?: readonly TvGamePlayer[];
  readonly readyPlayerIds?: readonly string[];
  readonly stage?: 'configuring' | 'ready' | 'countdown';
  /** Server epoch ms when the countdown's start is due; set only while counting down. */
  readonly countdownEndsAt?: number;
  readonly reduceMotion?: boolean;
};

/**
 * Display-only pre-game surface. The phone owns every control; the TV shows
 * the host's setup as it changes, then the ready check, then the countdown,
 * following the server's setup stage.
 */
export function TvGameSetupScreen(props: TvGameSetupScreenProps) {
  const { stage = 'configuring' } = props;
  if (stage === 'countdown' && props.countdownEndsAt !== undefined) {
    return <TvCountdownScreen {...props} countdownEndsAt={props.countdownEndsAt} />;
  }
  if (stage === 'ready' || stage === 'countdown') {
    return <TvReadyCheckScreen {...props} />;
  }
  return <SetupBoard {...props} />;
}

function SetupBoard({
  gameId,
  gameTitle,
  hostName,
  mode,
  settings,
  settingsSchema,
  players = [],
  reduceMotion = false,
}: TvGameSetupScreenProps) {
  const title = gameTitle?.trim() || titleForGame(gameId);
  const setupSettings = visibleTvSetupSettings(gameId, settings, settingsSchema);
  const art = playroomGameArt(gameId);
  const host = players.find((player) => player.isHost);
  const others = players.filter((player) => !player.isHost);

  return (
    <View style={styles.viewport} pointerEvents="none" focusable={false} accessible={false} testID="tv-game-setup">
      <PlayroomTvStage>
        <TvPlayroomFrame reduceMotion={reduceMotion} />
        <View style={styles.column} pointerEvents="none" focusable={false}>
          <PlayroomHeading type={playroomTv.type.heading}>{`Setting up ${title}`}</PlayroomHeading>
          <View style={styles.board}>
            <View style={styles.artCard} accessible accessibilityLabel={`${title}. ${tvHostCopy(hostName, 'is choosing the settings.')}`}>
              {art ? <Image source={art} style={styles.art} resizeMode="contain" accessible={false} /> : null}
              <PlayroomText style={playroomTv.type.title}>{title}</PlayroomText>
              <View style={styles.hostLine}>
                {host?.avatarId ? <PlayroomAvatar avatarId={host.avatarId} size={44} /> : null}
                <PlayroomText style={playroomTv.type.caption}>{tvHostCopy(hostName, 'is choosing the settings')}</PlayroomText>
              </View>
            </View>
            <View style={styles.settingsColumn}>
              <ModeTabs mode={mode} />
              <View style={styles.rows} testID="tv-game-setup-settings">
                {setupSettings.map((setting) => (
                  <SettingRow key={setting.key} setting={setting} reduceMotion={reduceMotion} />
                ))}
              </View>
            </View>
          </View>
        </View>
        {others.length > 0 ? (
          <View style={styles.waiting} pointerEvents="none" focusable={false}>
            <TvRosterRow players={others} size={playroomTv.avatar.row * 0.8} names={false} />
            <PlayroomText color="muted" style={playroomTv.type.caption}>
              Everyone else is waiting
            </PlayroomText>
          </View>
        ) : null}
      </PlayroomTvStage>
    </View>
  );
}

const MODES = ['quick', 'standard', 'custom'] as const;

function ModeTabs({ mode }: { readonly mode: string | undefined }) {
  return (
    <View style={styles.modes} accessible accessibilityLabel={`${tvModeLabel(mode)} setup`}>
      {MODES.map((option) => (
        <View key={option} style={[styles.mode, option === mode ? styles.modeOn : null]}>
          <PlayroomText color={option === mode ? 'ink' : 'muted'} style={playroomTv.type.caption}>
            {tvModeLabel(option)}
          </PlayroomText>
        </View>
      ))}
    </View>
  );
}

/** One setting; when the host changes it, the row lights up and fades back. */
function SettingRow({ setting, reduceMotion }: { readonly setting: TvSetupSetting; readonly reduceMotion: boolean }) {
  const highlight = useSharedValue(0);
  const previous = useRef(setting.value);
  useEffect(() => {
    if (previous.current === setting.value) return;
    previous.current = setting.value;
    if (reduceMotion) return;
    highlight.set(1);
    highlight.set(withTiming(0, { duration: playroomMotion.highlight }));
  }, [highlight, reduceMotion, setting.value]);
  const glow = useAnimatedStyle(() => ({ opacity: highlight.get() }));

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${setting.label ?? setting.key}: ${setting.value}`}
      testID={`tv-game-setting-${setting.key}`}
    >
      <Animated.View style={[styles.rowGlow, glow]} pointerEvents="none" />
      <PlayroomSettingIcon icon={setting.icon} size={64} />
      <PlayroomText style={[playroomTv.type.label, styles.rowLabel]}>{setting.label ?? setting.key}</PlayroomText>
      <PlayroomText style={styles.rowValue}>{setting.value}</PlayroomText>
    </View>
  );
}

function titleForGame(gameId: string): string {
  if (gameId === 'trivia') return 'Trivia';
  if (gameId === 'voting') return 'Voting';
  return 'Game';
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: playroomColors.canvas,
  },
  column: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: playroomTv.safeY - 10,
    gap: 28,
  },
  board: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 64,
  },
  artCard: {
    width: 580,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 30,
    paddingTop: 28,
    paddingBottom: 32,
    borderRadius: playroomRadii.card,
    backgroundColor: playroomColors.surface,
    ...playroomShadows.card,
  },
  art: {
    width: 460,
    height: 288,
  },
  hostLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
    paddingLeft: 6,
    paddingRight: 22,
    paddingVertical: 6,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.lavender,
  },
  settingsColumn: {
    width: 840,
    gap: 18,
  },
  modes: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    padding: 6,
    borderRadius: playroomRadii.pill,
    backgroundColor: playroomColors.lavender,
  },
  mode: {
    paddingHorizontal: 30,
    paddingVertical: 6,
    borderRadius: playroomRadii.pill,
  },
  modeOn: {
    backgroundColor: playroomColors.surface,
    borderWidth: 3,
    borderColor: playroomColors.ink,
  },
  rows: {
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: playroomColors.surface,
    overflow: 'hidden',
    ...playroomShadows.card,
  },
  rowGlow: {
    ...StyleSheet.absoluteFill,
    backgroundColor: playroomColors.lavender,
  },
  rowLabel: {
    flex: 1,
    fontFamily: playroomTv.type.title.fontFamily,
  },
  rowValue: {
    ...playroomTv.type.label,
    fontFamily: playroomTv.type.heading.fontFamily,
  },
  waiting: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: playroomTv.safeY + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
});
