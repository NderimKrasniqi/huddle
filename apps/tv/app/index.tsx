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
  playerFace,
  playerInitials,
  radius,
  shadowDepth,
  stickerTilt,
} from '@huddle/ui';
import { StickerSurface } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { type Arrivals, isArrival, JUST_JOINED_MS, noteArrivals } from '../src/just-joined';
import { closeExpiredRoom, deployed, openRoom } from '../src/room';
import {
  keepOpeningRoom,
  type OpenRoom,
  type RoomOpening,
  roomOpeningAtLaunch,
  type RoomOpeningCaption,
  roomOpeningCaption,
} from '../src/room-opening';
import {
  footerSeatCount,
  type RosterSeat,
  rosterFooterText,
  seat,
  seatHighlight,
  type SeatHighlight,
} from '../src/roster';
import { TvStage } from '../src/tv-stage';

/** The QR's edge, per the handoff ("~196px QR"). */
const QR_SIZE = 196;

/** The footer count's line box, pinned so it can be centred against the seats. */
const FOOTER_TEXT_LINE = 28;

/**
 * How a seat wears its news: Boardwalk's accent offset shadow, which is the
 * system's own way of highlighting a card — the handoff's signature rules give
 * the "JUST JOINED!" card an 8px shadow in punch pink.
 *
 * It rides the shadow rather than the border, where the §3 lobby card puts it,
 * because on a card the border is spare and on a seat it is not: the circle's
 * fill is the player's claimed color and its ink border is what makes the circle
 * a Boardwalk object at all. The shadow — offset outside the circle, onto the
 * screen's cream — is the one channel none of the ten fills can collide with.
 *
 * The Host's tangerine moves here from the circle's fill for that same reason.
 * The fill now says who a player is, and `tangerine` is one of the ten colors
 * anybody can claim, so a Host wearing it as a fill was about to be
 * indistinguishable from whoever claimed it. The palette still names tangerine
 * for the Host ("Brand accent, Host avatar"), and the HOST pill it stands in for
 * still waits on the §3 lobby card, which has the width to draw one.
 */
const seatHighlightShadow: Record<
  SeatHighlight,
  { readonly depth: number; readonly color: string }
> = {
  justJoined: { depth: shadowDepth.tvCardHighlight, color: colors.punch },
  // A step shallower than an arrival, so a phone landing mid-party visibly
  // lifts above the seat that is merely running the room.
  host: { depth: shadowDepth.tvCard, color: colors.tangerine },
};

/**
 * The TV — Pairing screen (docs/design/design-handoff.md §1): the Room Code in
 * four tiles, the QR that deep-links a phone straight into the room, and the
 * roster filling up underneath.
 */
export default function TvPairingScreen() {
  const { opening, reopen } = useRoomOpening();
  const room = opening.kind === 'open' ? opening.room : undefined;

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
            <PairingCaption caption={roomOpeningCaption(opening)} />
          </View>

          <RoomQrCard code={room?.code} />
        </View>

        {/* The screen's live subscriptions only exist once there is a room to
            subscribe to — and a room can only be open on a launch that has a
            Convex client for `ConvexProvider` to provide. Until then the footer
            draws its empty seats from nothing. */}
        {room === undefined ? (
          <RosterFooter roster={[]} arrivals={undefined} />
        ) : (
          // Keyed by the room, so a room that expires takes its seats and
          // everything this screen watched happen in it away with it: the
          // replacement starts as empty as a pairing screen on a fresh launch.
          <OpenRoomFooter key={room.roomId} room={room} onExpired={reopen} />
        )}
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

/**
 * The line under the tiles: the invitation to join, or — when there is no code
 * to join with — what has gone wrong, as a Boardwalk status chip.
 *
 * Trouble is promoted from the caption's quiet muted line to a bordered yellow
 * pill because of who is reading it and when: four blank code tiles are the
 * least explicable thing this app can put on a television, and the sentence
 * explaining them competes with a hero the size of the screen. The chip is
 * assembled from parts the system already has — the handoff's chip accent, its
 * pill radius, a TV card's 4px ink border and 6px offset shadow, a sticker tilt
 * that leans against the badge above it — because the handoff draws no failure
 * state for this screen at all (it draws a TV that is working).
 */
function PairingCaption({ caption }: { readonly caption: RoomOpeningCaption }) {
  if (!caption.trouble) {
    return <Text style={styles.caption}>{caption.text}</Text>;
  }

  return (
    <StickerSurface
      depth={shadowDepth.tvCard}
      style={styles.troubleChip}
      wrapperStyle={styles.troubleChipTilt}
    >
      <Text style={styles.troubleChipText}>{caption.text}</Text>
    </StickerSurface>
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
 * The footer of a screen that has a room: its roster, live, and a watch on the
 * room itself in case it ends.
 *
 * Both subscriptions are here rather than on the screen because this is the only
 * part of it that is mounted once a room is open, which is what keeps them — and
 * the `ConvexProvider` they need above them — out of a launch that never reached
 * a backend.
 */
function OpenRoomFooter({
  room,
  onExpired,
}: {
  readonly room: OpenRoom;
  readonly onExpired: (expired: OpenRoom) => void;
}) {
  const roster = useRoster(room);
  const arrivals = useArrivals(roster);
  useRoomExpiry(room, onExpired);

  return <RosterFooter roster={roster ?? []} arrivals={arrivals} />;
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
function RosterFooter({
  roster,
  arrivals,
}: {
  readonly roster: readonly RosterSeat[];
  readonly arrivals: Arrivals | undefined;
}) {
  return (
    <View style={styles.footer}>
      <View style={styles.seats}>
        {Array.from({ length: footerSeatCount(roster.length) }, (_unused, position) => {
          const player = roster[position];
          return player === undefined ? (
            <EmptySeat key={`empty-${position}`} />
          ) : (
            <PlayerSeat
              // Keyed by the player, so a seat belongs to one of them for as
              // long as they are in the room: it is the seat's own mount that
              // starts the four seconds below.
              key={player.playerId}
              player={player}
              arrived={arrivals !== undefined && isArrival(arrivals, player.playerId)}
            />
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
 * A player in their seat: their claimed color as the circle, their initials on
 * it in Bungee, the nickname under it, and the handoff's status dot on the
 * circle's edge — green while the room is hearing from their phone.
 *
 * The circle is a plain Boardwalk card face until a color is claimed, because a
 * player is seated the moment they join and the picker is the next screen their
 * phone shows them; `playerFace` is where both answers live, so a seat and the
 * hero avatar on that phone are never the same player in two different colors.
 * The monogram's own color comes with the fill: one ink cannot be read on all
 * ten (see `packages/ui/src/player-colors.ts`).
 *
 * Whatever else the seat has to say rides the offset shadow — an arrival in
 * punch pink, the Host in tangerine — for the reasons `seatHighlightShadow`
 * gives. An ordinary seat has no shadow at all, which is how the handoff draws
 * the footer's circles.
 *
 * Away dims the face the way Boardwalk dims anything present but not available,
 * and mutes the dot; the dimming goes on the wrapper so that a Host's shadow
 * fades with the circle it falls from. The nickname is not dimmed with them —
 * it is the one thing on the seat that has to be read from a sofa, and ink at
 * 30% over the screen color falls below any legible contrast. It takes the
 * muted text color the footer count is already set in, which says the same
 * thing and survives the room. The dot stays at full strength, because it is
 * what is doing the saying.
 */
function PlayerSeat({
  player,
  arrived,
}: {
  readonly player: RosterSeat;
  readonly arrived: boolean;
}) {
  const { nickname, away, color } = player;
  const justJoined = useJustJoined(arrived);
  const face = playerFace(color);
  const highlight = seatHighlight(player, justJoined);
  const news = highlight === undefined ? undefined : seatHighlightShadow[highlight];

  return (
    <View style={styles.seat}>
      <StickerSurface
        // No news, no shadow: a seat with nothing to say is the flat circle the
        // handoff's pairing footer draws.
        depth={news?.depth ?? 0}
        shadowColor={news?.color}
        style={[styles.avatar, styles.avatarTaken, { backgroundColor: face.fill }]}
        wrapperStyle={away ? styles.avatarAway : undefined}
      >
        <Text style={[styles.avatarInitials, { color: face.monogram }]}>
          {playerInitials(nickname)}
        </Text>
      </StickerSurface>
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
 * How the room this TV shows is getting on: opening, reconnecting, open, or
 * never going to open because this build has no deployment — and `reopen`, for
 * when the room that was open has expired and the screen needs another.
 *
 * `keepOpeningRoom` owns the retrying, and `openRoom` is memoised outside React
 * — so this effect re-running (StrictMode, Fast Refresh, a remount) rejoins the
 * attempt already in flight or reads the room already opened, rather than
 * minting another one. `reopen` is the one thing that clears that memo, which is
 * why it is also what starts the effect over: from here on the launch is exactly
 * as it was at the beginning, minus a room that no longer exists.
 */
function useRoomOpening(): {
  readonly opening: RoomOpening;
  readonly reopen: (expired: OpenRoom) => void;
} {
  /** How many rooms this screen has watched end — the trigger, not a statistic. */
  const [roomsEnded, setRoomsEnded] = useState(0);
  const [opening, setOpening] = useState<RoomOpening>(() => roomOpeningAtLaunch(deployed));

  useEffect(
    () => (deployed ? keepOpeningRoom(openRoom, setOpening) : undefined),
    // `deployed` is fixed at bundle time, so the only thing that ever opens a
    // second room is the first one expiring.
    [roomsEnded],
  );

  const reopen = useCallback((expired: OpenRoom) => {
    closeExpiredRoom(expired);
    setOpening(roomOpeningAtLaunch(deployed));
    setRoomsEnded((ended) => ended + 1);
  }, []);

  return { opening, reopen };
}

/**
 * Watches the room this TV is showing for the end of it.
 *
 * A room whose party has gone is deleted ten minutes later, and nobody is going
 * to touch the television about it — so the news has to arrive as a push, which
 * is what this subscription is. Until it does, the screen is showing a Room Code
 * that belongs to no room: the worst thing a pairing screen can display, because
 * it fails silently in the hands of whoever types it.
 *
 * It cannot be read off the roster, which is the subscription this screen
 * already holds: an expired room and a room nobody has joined are the same empty
 * roster, and they want opposite treatment.
 */
function useRoomExpiry(room: OpenRoom, onExpired: (expired: OpenRoom) => void): void {
  const stillOpen = useQuery(api.rooms.stillOpen, { roomId: room.roomId });

  useEffect(() => {
    // `undefined` is the moment before the first answer, which says nothing.
    if (stillOpen === false) {
      onExpired(room);
    }
  }, [stillOpen, room, onExpired]);
}

/**
 * Who is in the room, live. `useQuery` holds a subscription open for as long as
 * the screen is mounted, so a join reaches the TV as a push from Convex rather
 * than on a poll the TV would have to be awake for — the roster redraws within
 * a round trip of the phone's tap.
 *
 * The moment before the first answer lands is the `undefined` this hands on
 * rather than flattening to an empty room: a screen that has not been told who
 * is here is not a screen that has been told nobody is, and `useArrivals` is
 * the part of this one that has to tell the difference.
 */
function useRoster(room: OpenRoom): readonly RosterSeat[] | undefined {
  return useQuery(api.players.roster, { roomId: room.roomId });
}

/**
 * Who this screen has watched arrive, kept up with the roster.
 *
 * Folded during render rather than in an effect, because it is derived from the
 * roster and nothing else: the first snapshot to land is the baseline, and every
 * one after it is compared with what was already on the screen. `noteArrivals`
 * hands back the identical value whenever a snapshot seats nobody — which is
 * most of them, since claiming a color and going away both push a fresh roster —
 * so this settles on the render after a join and holds still through everything
 * else.
 */
function useArrivals(roster: readonly RosterSeat[] | undefined): Arrivals | undefined {
  const [arrivals, setArrivals] = useState<Arrivals>();
  const noted = roster === undefined ? arrivals : noteArrivals(arrivals, roster);

  if (noted !== arrivals) {
    setArrivals(noted);
  }

  return noted;
}

/**
 * A seat's four seconds of "JUST JOINED!", counted from the moment the seat
 * appears — which is this component mounting, since the footer keys a seat to
 * its player.
 *
 * The screen holds a clock nobody has to agree with, so this is a timer rather
 * than a timestamp: a seat settles when nothing at all has happened, and nothing
 * happening is precisely what a live query never reports. A seat the screen did
 * not watch arrive never starts one.
 */
function useJustJoined(arrived: boolean): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!arrived) {
      return undefined;
    }

    const timer = setTimeout(() => setSettled(true), JUST_JOINED_MS);

    return () => clearTimeout(timer);
  }, [arrived]);

  return arrived && !settled;
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
  // The caption's slot, in Boardwalk's chip accent, when the news is that
  // nothing is working: a TV card's border and shadow because it is on a TV,
  // and the pill radius every Boardwalk label wears.
  troubleChip: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderWidth: borderWidth.thick,
    borderRadius: radius.pill,
  },
  troubleChipTilt: {
    transform: [{ rotate: stickerTilt.statusChip }],
  },
  troubleChipText: {
    color: colors.ink,
    fontFamily: fontFamily.bodyMedium,
    // The caption's own size, which is well past the 18px a TV allows: this is
    // the one line on the screen that has to be read and acted on.
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
  // The fill is the player's claimed color and arrives with the seat; the ink
  // border is what every Boardwalk surface is drawn with, and stays put through
  // all ten of them.
  avatarTaken: {
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
  // The monogram's own color comes with the fill, from `playerFace`.
  avatarInitials: {
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
