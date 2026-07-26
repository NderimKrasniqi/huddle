import { ROOM_CODE_LENGTH, roomJoinLink } from '@huddle/game-core';
import {
  borderWidth,
  codeLetterColor,
  codeTileTilt,
  colors,
  fontFamily,
  letterSpacing,
  offsetShadow,
  radius,
  shadowDepth,
  stickerTilt,
} from '@huddle/ui';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { openRoom, type OpenRoom } from '../src/room';
import { TvStage } from '../src/tv-stage';

/** The QR's edge, per the handoff ("~196px QR"). */
const QR_SIZE = 196;

/** Dashed footer seats, as drawn in the handoff — a hint that the room is empty. */
const FOOTER_SEATS = 4;

/**
 * The TV — Pairing screen (docs/design/design-handoff.md §1): the Room Code in
 * four tiles, the QR that deep-links a phone straight into the room, and an
 * empty roster waiting to fill up.
 *
 * The footer count is fixed at zero because nothing can join yet; it starts
 * tracking the roster when the join flow lands (docs/implementation-plan.md).
 */
export default function TvPairingScreen() {
  const { room, failed } = useOpenedRoom();

  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            HUDDLE<Text style={styles.logoPeriod}>.</Text>
          </Text>
        </View>

        <View style={styles.center}>
          <View style={styles.codeGroup}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>GRAB YOUR PHONE!</Text>
            </View>
            <RoomCodeTiles code={room?.code} />
            <Text style={styles.caption}>
              {failed
                ? 'Could not open a room — check the Huddle backend and relaunch.'
                : 'Open Huddle on your phone and enter this code'}
            </Text>
          </View>

          <RoomQrCard code={room?.code} />
        </View>

        <View style={styles.footer}>
          <View style={styles.seats}>
            {Array.from({ length: FOOTER_SEATS }, (_unused, seat) => (
              <View key={seat} style={styles.seat} />
            ))}
          </View>
          <Text style={styles.footerText}>0 of 10 joined — waiting for players…</Text>
        </View>
      </View>
    </TvStage>
  );
}

/**
 * One tile per letter, in Boardwalk's per-position color and tilt. The tiles
 * are drawn before the code arrives so the screen does not reflow around it —
 * on a local backend the room opens well inside a couple of frames.
 */
function RoomCodeTiles({ code }: { readonly code: string | undefined }) {
  return (
    <View style={styles.tiles}>
      {Array.from({ length: ROOM_CODE_LENGTH }, (_unused, position) => (
        <View
          key={position}
          style={[styles.tile, { transform: [{ rotate: codeTileTilt(position) }] }]}
        >
          <Text style={[styles.tileLetter, { color: codeLetterColor(position) }]}>
            {code?.charAt(position) ?? ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The Join Link as a QR: scanning it opens the Controller straight into the room. */
function RoomQrCard({ code }: { readonly code: string | undefined }) {
  return (
    <View style={styles.qrCard}>
      <View style={styles.qr}>
        {code === undefined ? null : (
          <QRCode
            value={roomJoinLink(code)}
            size={QR_SIZE}
            color={colors.ink}
            backgroundColor={colors.surface}
          />
        )}
      </View>
      <Text style={styles.qrCaption}>or scan to join</Text>
    </View>
  );
}

/**
 * The room this TV opened. `openRoom` is memoised for the life of the app, so
 * this effect re-running — StrictMode, Fast Refresh, a remount — reads the same
 * room rather than minting another one.
 */
function useOpenedRoom(): { room: OpenRoom | undefined; failed: boolean } {
  const [room, setRoom] = useState<OpenRoom>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let watching = true;

    openRoom().then(
      (opened) => {
        if (watching) {
          setRoom(opened);
        }
      },
      (error: unknown) => {
        // The TV has no other channel to complain through, and the screen
        // itself only has room for the short version.
        console.error('Huddle TV could not open a room:', error);
        if (watching) {
          setFailed(true);
        }
      },
    );

    return () => {
      watching = false;
    };
  }, []);

  return { room, failed };
}

// Every measurement below is the handoff's own, at its 1280×720 design size;
// `TvStage` scales the lot to the television.
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },

  header: {
    paddingHorizontal: 56,
    paddingTop: 36,
  },
  logo: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 34,
  },
  logoPeriod: {
    color: colors.tangerine,
  },

  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 96,
  },

  codeGroup: {
    alignItems: 'center',
    gap: 28,
  },
  badge: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    backgroundColor: colors.tangerine,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
    boxShadow: offsetShadow(shadowDepth.phoneCard),
    transform: [{ rotate: stickerTilt.badge }],
  },
  badgeText: {
    color: colors.surface,
    fontFamily: fontFamily.display,
    fontSize: 20,
    letterSpacing: letterSpacing.badge,
  },
  tiles: {
    flexDirection: 'row',
    gap: 18,
  },
  tile: {
    width: 148,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.card,
    boxShadow: offsetShadow(shadowDepth.tvCard),
  },
  tileLetter: {
    fontFamily: fontFamily.display,
    fontSize: 88,
    // Bungee's line box is taller than its caps; pinning it keeps the letter
    // optically centred in the tile instead of riding low.
    lineHeight: 96,
  },
  caption: {
    color: colors.mutedText,
    fontFamily: fontFamily.body,
    fontSize: 22,
  },

  qrCard: {
    alignItems: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.card,
    boxShadow: offsetShadow(shadowDepth.tvCard),
    transform: [{ rotate: stickerTilt.qrCard }],
  },
  qr: {
    width: QR_SIZE,
    height: QR_SIZE,
  },
  qrCaption: {
    color: colors.mutedText,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 20,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingBottom: 36,
    paddingHorizontal: 56,
  },
  seats: {
    flexDirection: 'row',
    gap: 16,
  },
  seat: {
    width: 72,
    height: 72,
    borderColor: colors.mutedBorder,
    borderRadius: radius.pill,
    borderStyle: 'dashed',
    borderWidth: borderWidth.medium,
  },
  footerText: {
    color: colors.mutedText,
    fontFamily: fontFamily.body,
    fontSize: 22,
  },
});
