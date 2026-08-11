import { roomJoinLink, type GameSettingsMode, type GameSettingsPresentation, type GameSettingsSchema } from '@huddle/game-core';
import { gameModuleById } from '@huddle/game-registry';
import { colors, elevation } from '@huddle/ui';
import { Avatar, Icon, Surface, Wordmark } from '@huddle/ui/native';
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
          <Text style={styles.setupEyebrow}>GAME SETUP</Text>
          <Text style={styles.setupTitle}>{game.metadata.title}</Text>
          <Text style={styles.setupMode}>{capitalize(draft.mode)} mode</Text>
          <View style={styles.setupSummary}>
            {summary.map((line) => (
              <View key={line.label} style={styles.setupSummaryRow}>
                <Text style={styles.setupSummaryLabel}>{line.label}</Text>
                <Text style={styles.setupSummaryValue}>{line.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.setupHostLine}>
            {host === undefined ? null : <Avatar avatar={host.avatar} size={52} />}
            <View>
              <Text style={styles.setupHostCaption}>HOST</Text>
              <Text style={styles.setupHostName}>{host?.nickname ?? 'Waiting for Host'}</Text>
            </View>
            <Text style={styles.setupCount}>{roster.length}/10</Text>
          </View>
          <View style={styles.setupRoster}>
            {roster.map((seat) => (
              <Avatar key={seat.playerId} avatar={seat.avatar} size={40} label={seat.nickname} />
            ))}
          </View>
        </View>

        <View style={styles.setupRight}>
          <Surface elevation={elevation.tvCard} style={styles.joinCard}>
            <Text style={styles.joinCardEyebrow}>JOIN ON YOUR PHONE</Text>
            <QRCode value={roomJoinLink(code)} size={154} color={colors.ink} backgroundColor={colors.setupSurface} />
            <Text style={styles.joinCode}>{code}</Text>
            <Text style={styles.joinHint}>Scan the QR code or enter the four-letter code.</Text>
          </Surface>
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
