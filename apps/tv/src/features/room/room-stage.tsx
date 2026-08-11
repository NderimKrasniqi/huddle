import {
  type Arrivals,
  isGreeting,
  JUST_JOINED_MS,
  noteArrivals,
  ROOM_CODE_LENGTH,
  roomJoinLink,
} from '@huddle/game-core';
import { colors, elevation, motionDuration, popIn, springOf } from '@huddle/ui';
import { Avatar, Icon, Surface } from '@huddle/ui/native';
import { JoinCountRow, SectionDivider } from '@huddle/ui/kit';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  type RoomOpening,
  type RoomOpeningCaption,
  roomOpeningCaption,
} from '../../platform/room-session';
import { TvHeader, TvStage } from '../../ui/native';
import type { RosterSeat } from '../../models';
import {
  type RoomSeat,
  roomCountLine,
  ROOM_QR_SIZE,
  roomSeats,
  seat,
  seatSlot,
  seatSpokenAs,
} from './roster';
import { styles } from './styles';

export function RoomStage({
  opening,
  code,
  roster,
  greeting = greetsNobody,
  onGreeted = notedByNobody,
}: {
  readonly opening: RoomOpening;
  readonly code: string | undefined;
  readonly roster: readonly RosterSeat[];
  /**
   * Whether this player is inside their four seconds — see `isGreeting`. The
   * defaults are for the one Room that has no room behind it yet: an empty
   * roster has nobody to greet, so the screen that draws it needs neither the
   * question nor somewhere to put the answer.
   */
  readonly greeting?: (playerId: RosterSeat['playerId']) => boolean;
  readonly onGreeted?: (playerId: RosterSeat['playerId']) => void;
}) {
  return (
    <TvStage>
      <View style={styles.screen}>
        {/* Out of the flow, because the board puts the wordmark *beside* the
            title rather than above it: the title is centred on the stage and
            the mark sits in the left gutter alongside. A header row would stack
            them and push everything below 30pt down the screen. */}
        <View style={styles.roomWordmark}>
          <TvHeader />
        </View>

        <Text style={styles.roomTitle}>Grab your phone!</Text>

        <View style={styles.codeRow}>
          <View style={styles.codeGroup}>
            <RoomCodeTiles code={code} />
            <RoomCaption caption={roomOpeningCaption(opening)} />
          </View>

          <RoomQrCard code={code} />
        </View>

        <PlayersDivider />
        <PlayerGrid roster={roster} greeting={greeting} onGreeted={onGreeted} />
        <RoomCount roster={roster} />
      </View>
    </TvStage>
  );
}

/** A Room with no room behind it greets nobody, and has nobody to tell. */
const greetsNobody = () => false;
const notedByNobody = () => undefined;

/** The rule the roster sits under, with its label let into the middle of it. */
function PlayersDivider() {
  return <SectionDivider label="Players in the room" style={styles.divider} />;
}

/**
 * Every place in the room: the party, then the places still going spare.
 *
 * A fixed grid rather than one that grows with the roster. The dashed circles
 * are the invitation, and they are also what keeps the screen still — a seat
 * filling in a grid that resized around it would shuffle everybody else's face
 * sideways at the moment their own name went up.
 */
function PlayerGrid({
  roster,
  greeting,
  onGreeted,
}: {
  readonly roster: readonly RosterSeat[];
  readonly greeting: (playerId: RosterSeat['playerId']) => boolean;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
}) {
  return (
    <View style={styles.grid}>
      {roomSeats(roster).map((place) => (
        <PlayerSeat
          key={place.kind === 'taken' ? place.seat.playerId : `empty-${place.number}`}
          place={place}
          greeting={greeting}
          onGreeted={onGreeted}
        />
      ))}
    </View>
  );
}

/** One place in the grid: a player, or a dashed circle with its number in it. */

function PlayerSeat({
  place,
  greeting,
  onGreeted,
}: {
  readonly place: RoomSeat;
  readonly greeting: (playerId: RosterSeat['playerId']) => boolean;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
}) {
  if (place.kind === 'empty') {
    return (
      <View style={styles.seat}>
        <View style={[styles.seatAvatar, styles.seatAvatarEmpty]}>
          <Text style={styles.seatNumber}>{place.number}</Text>
        </View>
      </View>
    );
  }

  return (
    <TakenSeat
      seat={place.seat}
      greeting={greeting(place.seat.playerId)}
      onGreeted={onGreeted}
    />
  );
}

/**
 * A player's seat: their avatar, their name, and the one thing the room needs
 * to know about them.
 *
 * The four seconds of an arrival's greeting are counted here, as they always
 * were — the room does not record when a phone landed, and a live query reports
 * what happens rather than four seconds of nothing happening. What is *not*
 * counted here is whether they have already been spent: that answer is held by
 * the stage above, because this seat is torn down for the length of a game and
 * put back afterwards, and a greeting that restarted on the way back would
 * announce a phone that landed before the game did.
 */

function TakenSeat({
  seat: seated,
  greeting,
  onGreeted,
}: {
  readonly seat: RosterSeat;
  readonly greeting: boolean;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
}) {
  const { playerId } = seated;

  // Spending a greeting is what makes it spent, and the stage is told so that
  // the knowledge outlives this seat. The cleanup reports it too, not only the
  // timer: a game starting partway through the four seconds unmounts the whole
  // grid, and a television that comes back from ten minutes of trivia to
  // announce an arrival it was already announcing is worse than one that cut a
  // greeting short. Marking the same player twice is deliberately harmless.
  useEffect(() => {
    if (!greeting) {
      return undefined;
    }

    const timer = setTimeout(() => onGreeted(playerId), JUST_JOINED_MS);

    return () => {
      clearTimeout(timer);
      onGreeted(playerId);
    };
  }, [greeting, onGreeted, playerId]);

  // The handoff's avatar pop-in, back on the surface it was written for: the
  // face of the player who has just joined. See `usePopIn`.
  const pop = usePopIn(greeting);

  return (
    <View style={styles.seat}>
      <View style={styles.avatarWrap}>
        {seated.host ? (
          <View style={styles.hostCrown}>
            <Icon name="crown" size={28} color={colors.hostCrown} />
          </View>
        ) : null}
        <Animated.View style={pop}>
          <Avatar
            avatar={seated.avatar}
            size={seat.avatar}
            label={seatSpokenAs(seated, greeting)}
          />
        </Animated.View>
      </View>
      <Text style={styles.seatName} numberOfLines={1}>
        {seated.nickname}
      </Text>
      <SeatStatus seated={seated} greeting={greeting} />
    </View>
  );
}

/**
 * The slot under a nickname: `HOST`, a presence dot, or a chip.
 *
 * The board draws its `AWAY` chip in blue so a quiet player is distinguishable
 * from an online dot at sofa distance.
 */

function SeatStatus({
  seated,
  greeting,
}: {
  readonly seated: RosterSeat;
  readonly greeting: boolean;
}) {
  const slot = seatSlot(seated, greeting);

  // Every one of these is pinned to a single line. The slot is one line tall by
  // construction (`SEAT_HEIGHT`), so a label that wrapped would not overflow
  // tidily — it would push its own seat taller than the four beside it and
  // break the row.
  if (slot === 'justJoined') {
    return (
      <View style={[styles.seatChip, styles.seatChipJustJoined]}>
        <Text style={[styles.seatChipText, styles.seatChipTextJustJoined]} numberOfLines={1}>
          JUST JOINED!
        </Text>
      </View>
    );
  }

  if (slot === 'host') {
    return (
      <Text style={styles.seatHost} numberOfLines={1}>
        HOST
      </Text>
    );
  }

  if (slot === 'away') {
    return (
      <View style={[styles.seatChip, styles.seatChipAway]}>
        <Text style={[styles.seatChipText, styles.seatChipTextAway]} numberOfLines={1}>
          AWAY
        </Text>
      </View>
    );
  }

  return <View style={styles.seatDot} />;
}

/**
 * The line under the grid: how full the room is, and what that means.
 *
 * The count itself is set in the accent, which is the one place on this screen
 * a number is worth finding from across a room — it is the answer to "are we
 * all in yet".
 */

function RoomCount({ roster }: { readonly roster: readonly RosterSeat[] }) {
  const { joined, total, note } = roomCountLine(
    roster.length,
    roster.find((seated) => seated.host)?.nickname,
  );

  return <JoinCountRow joined={joined} total={total} note={note} style={styles.countLine} />;
}

/**
 * TV — Game carousel (`docs/design/reference/screens/02-game-carousel.png`): the
 * game the Host is browsing, with its neighbours either side.
 *
 * Games and nothing else. The board draws no roster here and no room chip
 * either, which is the other half of the Room screen keeping the code: a
 * latecomer reads it off the Room the party came from, and this screen is the
 * moment the room stops recruiting and starts choosing.
 *
 * The television is a renderer here as everywhere else — it draws the index the
 * room stored, and the Host's phone is the only thing that moves it. Nothing on
 * this screen knows which game it is showing: the card is `GameMetadata`, which
 * is what metadata is for.
 */

function RoomCodeTiles({ code }: { readonly code: string | undefined }) {
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

/**
 * The line under the tiles: the invitation to join, or — when there is no code
 * to join with — what has gone wrong, as a chip.
 *
 * Trouble is promoted from the caption's quiet muted line to a bordered chip
 * because of who is reading it and when: four blank code tiles are the least
 * explicable thing this app can put on a television, and the sentence
 * explaining them competes with a hero the size of the screen. The chip is
 * assembled from parts the system already has — the soft peach accent surface,
 * a hairline border and a TV card's shadow — because the design package draws
 * no failure state for this screen at all (it draws a TV that is working).
 */

function RoomCaption({ caption }: { readonly caption: RoomOpeningCaption }) {
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

/**
 * The Join Link as a QR: scanning it opens the Controller straight into the
 * room.
 *
 * No caption under it, which the board is explicit about — a QR standing beside
 * a room code that already says "open Huddle on your phone" needs no second
 * sentence, and the space it would take is the space the roster grew into.
 */

function RoomQrCard({ code }: { readonly code: string | undefined }) {
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

function useArrivals(
  roster: readonly RosterSeat[] | undefined,
): Arrivals<RosterSeat['playerId']> | undefined {
  const [arrivals, setArrivals] = useState<Arrivals<RosterSeat['playerId']>>();
  const noted = roster === undefined ? arrivals : noteArrivals(arrivals, roster);

  if (noted !== arrivals) {
    setArrivals(noted);
  }

  return noted;
}

/**
 * Which arrivals this television has already spent its four seconds on.
 *
 * Being an Arrival is permanent — a player stays one for as long as they stay
 * seated — but a greeting is not, and nothing in a live query ever reports the
 * four seconds ending. So the screen remembers, and this is the memory: it lives
 * above the switch between the carousel and a game, which is the one trip that
 * would otherwise re-announce a phone that landed before the game started.
 *
 * The same player being noted twice is expected rather than guarded against: the
 * greeting is marked spent both when it runs out and when a game cuts it short,
 * and those are the same fact. The set is returned unchanged when it already
 * holds the player, because the component doing the noting re-renders on it.
 */

function useGreeted(): {
  readonly greeted: ReadonlySet<RosterSeat['playerId']>;
  readonly noteGreeted: (playerId: RosterSeat['playerId']) => void;
} {
  const [greeted, setGreeted] = useState<ReadonlySet<RosterSeat['playerId']>>(() => new Set());

  const noteGreeted = useCallback((playerId: RosterSeat['playerId']) => {
    setGreeted((already) =>
      already.has(playerId) ? already : new Set(already).add(playerId),
    );
  }, []);

  return { greeted, noteGreeted };
}

/**
 * The Card Transition: the carousel row sliding into place behind an index the
 * room has just moved (handoff — "TV animates card transition ~250ms ease-out").
 *
 * Which index this screen was drawing is state rather than a ref, and it is
 * folded during render the way `useArrivals` folds the roster: the animation is
 * derived from the index changing, and an effect that compared indices would be
 * a second opinion about what the render already knows. `cardEntryOffset` turns
 * the pair into the direction the strip travels, and a zero offset — a mount, a
 * roster push, a re-render for any of the other reasons this screen has — is no
 * animation at all rather than a 250ms animation of nothing.
 *
 * `useLayoutEffect` because the reset and the frame it is reset for must be the
 * same frame. The driver is left settled between transitions, so an ordinary
 * effect would commit one frame of the new cards already in place and only then
 * throw them back out to their starting offset — a backwards jump at the head of
 * every transition, which is precisely the stutter this is meant to remove.
 */

function usePopIn(greeting: boolean): { readonly transform: readonly [{ scale: Animated.Value }] } {
  const [scale] = useState(() => new Animated.Value(greeting ? popIn.fromScale : 1));

  useEffect(() => {
    if (!greeting) {
      return undefined;
    }

    // Reset before springing, so the hook does not quietly depend on how it is
    // mounted. A seat is keyed by its player, so an arriving one is a fresh
    // instance whose scale starts at 0.6 — but a seat that has been in the room
    // since before the last game and is being greeted again after a rejoin is
    // the same instance, and without this line its scale would sit at 1, spring
    // 1→1, and delete the pop-in with every test still green.
    scale.setValue(popIn.fromScale);

    const spring = Animated.spring(scale, {
      toValue: 1,
      ...springOf(motionDuration.popIn, popIn.dampingRatio),
      useNativeDriver: true,
    });

    spring.start();

    return () => spring.stop();
  }, [greeting, scale]);

  return { transform: [{ scale }] };
}

export function useRoomGreetings(roster: readonly RosterSeat[] | undefined): {
  readonly greeting: (playerId: RosterSeat['playerId']) => boolean;
  readonly onGreeted: (playerId: RosterSeat['playerId']) => void;
} {
  const arrivals = useArrivals(roster);
  const { greeted, noteGreeted } = useGreeted();
  return {
    greeting: (playerId) => isGreeting(arrivals, greeted, playerId),
    onGreeted: noteGreeted,
  };
}
