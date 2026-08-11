import { ROOM_CODE_LENGTH, roomJoinLink } from '@huddle/game-core';
import { colors, elevation } from '@huddle/ui';
import { Surface } from '@huddle/ui/native';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import type { RoomOpeningCaption } from '../../platform/room-session';
import { ROOM_QR_SIZE } from './roster';
import { styles } from './styles';

/** The code tiles and QR invitation owned by the TV Room surface. */
export function RoomCodeTiles({ code }: { readonly code: string | undefined }) {
  return (
    <View style={styles.tiles}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_unused, position) => (
        <Surface key={position} elevation={elevation.tvCard} style={styles.tile}>
          <Text style={styles.tileLetter}>{code?.charAt(position) ?? ''}</Text>
        </Surface>
      ))}
    </View>
  );
}

export function RoomCaption({ caption }: { readonly caption: RoomOpeningCaption }) {
  if (caption.kind === 'invitation') {
    return (
      <Text style={styles.caption}>
        {caption.before}
        <Text style={styles.captionEmphasis}>{caption.emphasis}</Text>
        {caption.after}
      </Text>
    );
  }

  return (
    <Surface elevation={elevation.tvCard} style={styles.troubleChip}>
      <Text style={styles.troubleChipText}>{caption.text}</Text>
    </Surface>
  );
}

export function RoomQrCard({ code }: { readonly code: string | undefined }) {
  return (
    <Surface elevation={elevation.tvCard} style={styles.qrCard}>
      <View style={styles.qr}>
        {code === undefined ? null : (
          <QRCode
            value={roomJoinLink(code)}
            size={ROOM_QR_SIZE}
            color={colors.ink}
            backgroundColor={colors.roomSurface}
          />
        )}
      </View>
    </Surface>
  );
}
