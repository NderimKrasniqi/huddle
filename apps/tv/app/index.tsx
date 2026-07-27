import { api } from '@huddle/convex';
import { ROOM_CODE_LENGTH, roomJoinLink } from '@huddle/game-core';
import {
  borderWidth,
  codeLetterColor,
  codeTileTilt,
  colors,
  fontFamily,
  letterSpacing,
  minBodyFontSize,
  opacity,
  playerInitials,
  radius,
  shadowDepth,
  stickerTilt,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { openRoom, type OpenRoom } from '../src/room';
import { footerSeatCount, rosterFooterText, seat } from '../src/roster';
import { TvStage } from '../src/tv-stage';

/** The QR's edge, per the handoff ("~196px QR"). */
const QR_SIZE = 196;

/** The footer count's line box, pinned so it can be centred against the seats. */
const FOOTER_TEXT_LINE = 28;

/**
 * One taken seat of the TV's roster, taken from the query that serves it — the
 * TV draws what the backend says a seat is, and never its own idea of one.
 */
type RosterSeat = FunctionReturnType<typeof api.players.roster>[number];

/**
 * The TV — Pairing screen (docs/design/design-handoff.md §1): the Room Code in
 * four tiles, the QR that deep-links a phone straight into the room, and the
 * roster filling up underneath.
 */
export default function TvPairingScreen() {
  const { room, failed } = useOpenedRoom();
  const roster = useRoster(room);

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
            <StickerSurface
              depth={shadowDepth.phoneCard}
              style={styles.badge}
              wrapperStyle={styles.badgeTilt}
            >
              <Text style={styles.badgeText}>GRAB YOUR PHONE!</Text>
            </StickerSurface>
            <RoomCodeTiles code={room?.code} />
            <Text style={styles.caption}>
              {failed
                ? 'Could not open a room — check the Huddle backend and relaunch.'
                : 'Open Huddle on your phone and enter this code'}
            </Text>
          </View>

          <RoomQrCard code={room?.code} />
        </View>

        <RosterFooter roster={roster} />
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
        <StickerSurface
          key={position}
          depth={shadowDepth.tvCard}
          style={styles.tile}
          // The tilt goes on the wrapper: rotating the tile alone would swing
          // it off its own shadow.
          wrapperStyle={{ transform: [{ rotate: codeTileTilt(position) }] }}
        >
          <Text style={[styles.tileLetter, { color: codeLetterColor(position) }]}>
            {code?.charAt(position) ?? ''}
          </Text>
        </StickerSurface>
      ))}
    </View>
  );
}

/** The Join Link as a QR: scanning it opens the Controller straight into the room. */
function RoomQrCard({ code }: { readonly code: string | undefined }) {
  return (
    <StickerSurface
      depth={shadowDepth.tvCard}
      style={styles.qrCard}
      wrapperStyle={styles.qrCardTilt}
    >
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
    </StickerSurface>
  );
}

/**
 * The roster under the code: a seat per player, and dashed empty ones for as
 * long as the room looks empty. A player's seat carries their nickname because
 * that is the point of the screen — the room's own name for them, up on the TV,
 * the moment their phone lands.
 *
 * An away player keeps their seat. Presence is drawn on it, never subtracted
 * from it: the room still holds their place, and the count under the seats is
 * how many phones are in the room, not how many are awake.
 */
function RosterFooter({ roster }: { readonly roster: readonly RosterSeat[] }) {
  return (
    <View style={styles.footer}>
      <View style={styles.seats}>
        {Array.from({ length: footerSeatCount(roster.length) }, (_unused, position) => {
          const player = roster[position];
          return player === undefined ? (
            <EmptySeat key={`empty-${position}`} />
          ) : (
            <PlayerSeat key={player.playerId} nickname={player.nickname} away={player.away} />
          );
        })}
      </View>
      <Text style={styles.footerText}>{rosterFooterText(roster.length)}</Text>
    </View>
  );
}

/** A seat nobody has taken: the handoff's dashed circle. */
function EmptySeat() {
  return (
    <View style={styles.seat}>
      <View style={[styles.avatar, styles.avatarEmpty]} />
    </View>
  );
}

/**
 * A player in their seat: Boardwalk's avatar circle with Bungee initials, the
 * nickname under it, and the handoff's status dot on the circle's edge — green
 * while the room is hearing from their phone. The circle takes the player's
 * claimed color in Phase 2's color-claim task; until a color is claimed there
 * is nothing to claim it with, so the circle stays a plain Boardwalk card face.
 *
 * Away dims the face the way Boardwalk dims anything present but not available,
 * and mutes the dot. The nickname is not dimmed with them — it is the one thing
 * on the seat that has to be read from a sofa, and ink at 30% over the screen
 * color falls below any legible contrast. It takes the muted text color the
 * footer count is already set in, which says the same thing and survives the
 * room. The dot stays at full strength, because it is what is doing the saying.
 */
function PlayerSeat({ nickname, away }: { readonly nickname: string; readonly away: boolean }) {
  return (
    <View style={styles.seat}>
      <View style={[styles.avatar, styles.avatarTaken, away && styles.avatarAway]}>
        <Text style={styles.avatarInitials}>{playerInitials(nickname)}</Text>
      </View>
      {/* A sibling of the circle rather than a child of it. The dot sits half
          off the circle's edge, which is precisely the geometry a rounded
          parent would be entitled to clip; positioning it against the seat
          instead leaves nothing for either platform to decide. */}
      <View style={[styles.statusDot, away && styles.statusDotAway]} />
      <Text style={[styles.seatName, away && styles.seatNameAway]} numberOfLines={1}>
        {nickname}
      </Text>
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

/**
 * Who is in the room, live. `useQuery` holds a subscription open for as long as
 * the screen is mounted, so a join reaches the TV as a push from Convex rather
 * than on a poll the TV would have to be awake for — the roster redraws within
 * a round trip of the phone's tap.
 *
 * Until the room is open there is nothing to subscribe to, and an unopened room
 * and an empty one draw the same seats anyway.
 */
function useRoster(room: OpenRoom | undefined): readonly RosterSeat[] {
  const roster = useQuery(
    api.players.roster,
    room === undefined ? 'skip' : { roomId: room.roomId },
  );

  return roster ?? [];
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
  },
  badgeTilt: {
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
  },
  qrCardTilt: {
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
    // Top-aligned, and the count is dropped onto the circles' centre line
    // below: centring the row instead would hang the count off the middle of a
    // seat *and its reserved name line*, half a name lower than the handoff
    // draws it.
    alignItems: 'flex-start',
    gap: 24,
    paddingBottom: 36,
    paddingHorizontal: 56,
  },
  seats: {
    flexDirection: 'row',
    gap: seat.gap,
  },
  seat: {
    width: seat.size,
    // The nickname's line is reserved on every seat, taken or not, so that the
    // screen holds still when a phone joins mid-party.
    height: seat.size + seat.nameGap + seat.nameLine,
    alignItems: 'center',
    gap: seat.nameGap,
  },
  avatar: {
    width: seat.size,
    height: seat.size,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: borderWidth.medium,
  },
  avatarEmpty: {
    borderColor: colors.mutedBorder,
    borderStyle: 'dashed',
  },
  avatarTaken: {
    backgroundColor: colors.surface,
    borderColor: colors.ink,
  },
  // Boardwalk's own treatment for something present but not available: the
  // handoff dims a claimed color swatch to 30%, and an away player's face is
  // the same kind of statement. Only the circle — text at this opacity stops
  // being readable across a room, which is the one thing a TV cannot afford.
  avatarAway: {
    opacity: opacity.unavailable,
  },
  // On the lower-right of the avatar circle, where the handoff puts the online
  // dot. Absolute against the seat, whose width is the circle's own.
  statusDot: {
    position: 'absolute',
    top: seat.size - seat.statusDot - seat.statusInset,
    right: seat.statusInset,
    width: seat.statusDot,
    height: seat.statusDot,
    backgroundColor: colors.green,
    borderColor: colors.ink,
    borderWidth: borderWidth.medium,
    borderRadius: radius.pill,
  },
  statusDotAway: {
    backgroundColor: colors.mutedBorder,
  },
  avatarInitials: {
    color: colors.ink,
    fontFamily: fontFamily.display,
    fontSize: 24,
    // Bungee's line box runs taller than its caps; pinning it centres the
    // monogram in the circle instead of letting it ride low.
    lineHeight: 26,
  },
  seatName: {
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
    // A seat is only as wide as its avatar, so the nickname is set at the
    // smallest size Boardwalk allows on a TV and clipped if it runs past.
    fontSize: minBodyFontSize.tv,
    lineHeight: seat.nameLine,
  },
  seatNameAway: {
    color: colors.mutedText,
  },
  footerText: {
    color: colors.mutedText,
    fontFamily: fontFamily.body,
    fontSize: 22,
    lineHeight: FOOTER_TEXT_LINE,
    // Onto the centre line of the avatar circles beside it, where the handoff
    // has it, rather than the centre of the taller seat that holds them.
    marginTop: (seat.size - FOOTER_TEXT_LINE) / 2,
  },
});
