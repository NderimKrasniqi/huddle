import {
  ROOM_CODE_LENGTH,
  ROOM_PLAYER_CAP,
  roomJoinLink,
  type GameSettingsMode,
  type GameSettingsPresentation,
  type GameSettingsSchema,
} from '@huddle/game-core';
import { gameModuleById } from '@huddle/game-registry';
import { colors, type IconName } from '@huddle/ui';
import { Avatar, Icon, Wordmark } from '@huddle/ui/native';
import QRCode from 'react-native-qrcode-svg';
import { Text, View } from 'react-native';

import { TvStage } from '../../ui';
import type { RosterSeat } from '../room';
import background from '@huddle/ui/assets/tv-backgrounds/game-setup-background.png';
import { styles } from './styles';

type SetupDraft = {
  readonly gameId: string;
  readonly settings: Readonly<Record<string, string>>;
  readonly mode: GameSettingsMode;
};

export function GameSetupStage({
  code,
  draft,
  roster,
}: {
  readonly code: string;
  readonly draft: SetupDraft;
  readonly roster: readonly RosterSeat[];
}) {
  const game = gameModuleById(draft.gameId);
  if (game === undefined) return null;
  const summary = settingSummary(game.settingsSchema, game.settingsPresentation, draft.settings);
  const host = roster.find((seat) => seat.host);

  return (
    <TvStage backgroundSource={background}>
      <View style={styles.screen}>
        <View style={styles.setupLeft}>
          <Wordmark on="dark" height={42} />
          <Text style={styles.setupTitle}>{game.metadata.title}</Text>
          <View style={styles.setupMode}>
            <Text style={styles.setupModeText}>{capitalize(draft.mode)} mode</Text>
          </View>
          <View style={styles.setupSummary}>
            {summary.map((line) => (
              <View key={line.label} style={styles.setupSummaryRow}>
                <Icon name={setupRuleIcon(line.label)} size={24} color={colors.setupGold} />
                <View style={styles.setupSummaryCopy}>
                  <Text style={styles.setupSummaryLabel}>{line.label}</Text>
                  <Text style={styles.setupSummaryValue}>{line.value}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.setupHostLineText}>
            {host === undefined ? 'Waiting for the Host to finish setting up.' : `${host.nickname} (host) is setting up the game.`}
          </Text>
          <View style={styles.setupJoinedBlock}>
            <View style={styles.setupJoinedLine}>
              <Icon name="players" size={24} color={colors.setupText} />
              <Text style={styles.setupJoinedText}>
                <Text style={styles.setupJoinedCount}>{roster.length}</Text> of {ROOM_PLAYER_CAP} players joined
              </Text>
            </View>
            <View style={styles.setupRoster}>
              {roster.slice(0, 8).map((seat) => (
                <Avatar key={seat.playerId} avatar={seat.avatar} size={48} label={seat.nickname} />
              ))}
              {roster.length > 8 ? (
                <View style={styles.setupRosterMore}>
                  <Text style={styles.setupRosterMoreText}>+{roster.length - 8}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.setupRight}>
          <Text style={styles.setupRightText}>Players can still join while the Host is setting up.</Text>
          <View style={styles.joinCard}>
            <QRCode value={roomJoinLink(code)} size={164} color={colors.ink} backgroundColor={colors.setupSurface} />
            <Text style={styles.joinCardEyebrow}>JOIN WITH CODE</Text>
            <View style={styles.setupCodeRow}>
              {Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => (
                <View key={index} style={styles.setupCodeBox}>
                  <Text style={styles.setupCodeBoxText}>{code[index] ?? ''}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.joinPill}>
            <Icon name="tv" size={22} color={colors.inverse} />
            <Text style={styles.joinPillText}>Values mirror the Host phone live</Text>
          </View>
        </View>
      </View>
    </TvStage>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setupRuleIcon(label: string): IconName {
  if (label === 'Time per question') return 'clock';
  if (label === 'Category') return 'tag';
  if (label === 'Difficulty') return 'scan';
  if (label === 'Questions') return 'gamepad';
  return 'tv';
}

function settingSummary(
  schema: GameSettingsSchema,
  presentation: GameSettingsPresentation | undefined,
  settings: Readonly<Record<string, string>>,
) {
  const visible = presentation?.customSettingKeys;
  return schema
    .filter((setting) => visible === undefined || visible.includes(setting.key))
    .map((setting) => ({
      label: setting.label,
      value: setting.options.find((option) => option.value === settings[setting.key])?.label ?? settings[setting.key] ?? setting.defaultValue,
    }));
}
