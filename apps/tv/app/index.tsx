import { api } from '@huddle/convex';
import {
  gamePlayersFrom,
  type GameModule,
  ROOM_CODE_LENGTH,
  roomJoinLink,
} from '@huddle/game-core';
import { type CarouselWindow, carouselWindow, runningGameScreen } from '@huddle/game-registry';
import {
  borderWidth,
  codeLetterBox,
  colors,
  fontFamily,
  letterSpacing,
  minBodyFontSize,
  motionDuration,
  opacity,
  popIn,
  radius,
  elevation,
  springOf,
} from '@huddle/ui';
import { Avatar, Surface, Wordmark } from '@huddle/ui/native';
import { useQuery } from 'convex/react';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { cardEntryOffset } from '../src/card-transition';
import { carouselFooterLine } from '../src/carousel-footer';
import { type Arrivals, isGreeting, JUST_JOINED_MS, noteArrivals } from '../src/just-joined';
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
  type RoomSeat,
  roomCountLine,
  roomLayout,
  roomSeats,
  type RosterSeat,
  seat,
  SEAT_HEIGHT,
  seatSlot,
  seatSpokenAs,
  SEATS_PER_ROW,
} from '../src/roster';
import { TvStage } from '../src/tv-stage';

/** The QR bitmap's edge; the board's measures 95 inside a 128pt card. */
const QR_SIZE = 96;

/**
 * A TV footer's line box at 22px, pinned rather than left to React Native's
 * default. The carousel's footer *is* this line, which makes that footer's
 * height — and so how far the page dots clear the focused card's shadow — a
 * measured number rather than an inferred one.
 */
const FOOTER_TEXT_LINE = 28;

/**
 * The TV — Room (`docs/design/reference/screens/01-room.png`): the Room Code in
 * four tiles, the QR that deep-links a phone straight into the room, and the
 * roster filling up underneath.
 */
export default function TvRoomScreen() {
  const { opening, reopen } = useRoomOpening();
  const room = opening.kind === 'open' ? opening.room : undefined;

  // The screen's live subscriptions only exist once there is a room to
  // subscribe to — and a room can only be open on a launch that has a Convex
  // client for `ConvexProvider` to provide. Until then the Room draws its
  // empty seats from nothing.
  if (room === undefined) {
    return <RoomStage opening={opening} code={undefined} roster={[]} />;
  }

  // Keyed by the room, so a room that expires takes its seats and everything
  // this screen watched happen in it away with it: the replacement starts as
  // empty as a Room on a fresh launch.
  return <OpenRoomStage key={room.roomId} room={room} opening={opening} onExpired={reopen} />;
}

/**
 * A television with a room open on it: the Room, the carousel the Host is
 * browsing, or the game they picked.
 *
 * The room's subscriptions live here rather than in any screen below, because
 * they must outlive the switch between them. Expiry is the one that matters: a
 * room that ends while a game is on screen still has to send this television
 * back to a fresh Room Code, and a `stillOpen` subscription mounted inside the
 * lobby would stop watching the moment the game started.
 */
function OpenRoomStage({
  room,
  opening,
  onExpired,
}: {
  readonly room: OpenRoom;
  readonly opening: RoomOpening;
  readonly onExpired: (expired: OpenRoom) => void;
}) {
  const roster = useRoster(room);
  const arrivals = useArrivals(roster);
  // Which greetings this television has already spent. It is held here, beside
  // the subscriptions, for the same reason they are: it has to outlive the
  // switch to a game and back, which is precisely the trip that would otherwise
  // announce every arrival the room already knows about all over again.
  const { greeted, noteGreeted } = useGreeted();
  useRoomExpiry(room, onExpired);

  // What the room says it is playing. Its own subscription: this changes twice
  // a game, where the roster changes on every join, claim and heartbeat.
  const running = useQuery(api.games.running, { roomId: room.roomId });
  const screen = runningGameScreen(running);
  // Which card the Host is on, or `null` for a room nobody has browsed in yet.
  // Its own subscription, and the one the AC times: the room writes it on a tap
  // and Convex pushes it here.
  const browsingAt = useQuery(api.games.browsing, { roomId: room.roomId });

  if (screen.kind === 'unknownGame') {
    return <UnknownGameStage gameId={screen.gameId} />;
  }

  if (screen.kind === 'game') {
    return <GameStage module={screen.module} state={screen.state} roster={roster ?? []} />;
  }

  const seats = roster ?? [];
  // `undefined` is the moment before the first answer and `null` is a room
  // nobody has browsed in; neither is a card, and both leave the Room up.
  const browsing =
    browsingAt === undefined || browsingAt === null ? undefined : carouselWindow(browsingAt);

  // The Room stands until the Host starts browsing, and not one join sooner.
  //
  // Boardwalk switched here on `seats.length > 0`, which meant the Room Code
  // left the television the instant the first phone landed and everybody after
  // them had to be told it. The approved board draws code, QR and roster on one
  // screen for exactly that reason, so the only thing that now replaces the
  // Room is the Host picking up the carousel — a deliberate act, by the one
  // person who can start a game, at the moment the code has done its job.
  if (browsing === undefined) {
    return (
      <RoomStage
        opening={opening}
        code={room.code}
        roster={seats}
        greeting={(playerId) => isGreeting(arrivals, greeted, playerId)}
        onGreeted={noteGreeted}
      />
    );
  }

  return <CarouselStage window={browsing} roster={seats} />;
}

/**
 * The TV — Room (`docs/design/reference/screens/01-room.png`): the Room Code and
 * its QR over a grid of everyone who is in, held up for as long as the room is
 * between games.
 *
 * One screen rather than two is the whole change from Boardwalk here. That
 * television swapped this out for the carousel at the first join, which put the
 * code in a header chip from the second player onward — and the second player
 * is precisely who still needs to read it. Nothing about the room's news has to
 * travel to another surface any more: a seat can say who the Host is, who has
 * just landed and who has gone quiet, on the screen the whole party is already
 * looking at.
 */
function RoomStage({
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
          <Wordmark height={roomLayout.wordmark} />
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
  return (
    <View style={styles.divider}>
      <View style={styles.dividerRule} />
      <Text style={styles.dividerLabel}>PLAYERS IN THE ROOM</Text>
      <View style={styles.dividerRule} />
    </View>
  );
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
      <Animated.View style={pop}>
        <Avatar
          avatar={seated.avatar}
          size={seat.avatar}
          label={seatSpokenAs(seated, greeting)}
        />
      </Animated.View>
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
 * The board draws its `AWAY` chip in blue, and this one is grey. Blue is the
 * system's one informational colour and it is already spoken for — `JUST
 * JOINED!` is what it means — and these two states share a slot, so drawing
 * both of them blue would make the loudest thing on the grid ambiguous. Grey is
 * also what `colors.away` is for, and what the Host's own roster already uses
 * to say the same thing about the same player.
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

  return (
    <Text style={styles.countLine}>
      <Text style={styles.countJoined}>{joined}</Text>
      {` of ${total} joined`}
      {note === undefined ? '' : ` — ${note}`}
    </Text>
  );
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
function CarouselStage({
  window,
  roster,
}: {
  readonly window: CarouselWindow;
  readonly roster: readonly RosterSeat[];
}) {
  const host = roster.find((seated) => seated.host);

  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Wordmark height={roomLayout.wordmark} />
        </View>

        <CarouselCards window={window} />

        <View style={styles.carouselFooter}>
          <View style={styles.pageDots}>
            {Array.from({ length: window.total }, (_unused, position) => (
              <View
                key={position}
                style={[styles.pageDot, position === window.index && styles.pageDotActive]}
              />
            ))}
          </View>
          <Text style={styles.browsingLine}>{carouselFooterLine(host)}</Text>
        </View>
      </View>
    </TvStage>
  );
}

/**
 * The three cards, and the Card Transition between them (the handoff's
 * "TV animates card transition ~250ms ease-out").
 *
 * The row slides in from the direction the room browsed: the cards themselves
 * are swapped by the render that follows Convex's push, so what travels is the
 * row arriving where the new focused card belongs, not each card moving to its
 * own new place. `cardEntryOffset` decides the sign;
 * `motionDuration.cardTransition` and the ease-out are the handoff's.
 *
 * A slide and nothing else — no fade, no scale. The handoff pins the duration
 * and the easing and leaves the rest, and a translation is the one thing on this
 * screen that cannot cost a measurement: it is not laid out, so no card, dot or
 * shadow moves anywhere Yoga can see it, and the footer's 10pt of daylight under
 * the focused card's shadow is exactly where the last task left it.
 */
function CarouselCards({ window }: { readonly window: CarouselWindow }) {
  const entry = useCardTransition(window.index);

  return (
    <Animated.View style={[styles.carousel, entry]}>
      {/* The side cards are absent rather than duplicated with one game
          installed — `carouselWindow` is what decides that, and this just
          draws what it was handed. */}
      <SideKeyArt game={window.previous} />
      <FocusedGameCard game={window.focused} />
      <SideKeyArt game={window.next} />
    </Animated.View>
  );
}

/**
 * The focused card: key art over the title and its chips (handoff §6 — 440×520,
 * 4px ink border, 10px cobalt offset shadow).
 */
function FocusedGameCard({ game }: { readonly game: GameModule }) {
  const { title, keyArt, playerRange, estimatedMinutes, category } = game.metadata;

  return (
    <Surface
      elevation={elevation.tvHero}
      style={styles.focusedCard}
    >
      <View style={[styles.keyArt, { backgroundColor: colors[keyArt.color] }]}>
        <Text style={styles.keyArtTitle}>{title}</Text>
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <View style={styles.chips}>
          <Chip text={`${playerRange.min}–${playerRange.max} players`} />
          <Chip text={`~${estimatedMinutes} min`} />
          <Chip text={category} tone={colors.soft} />
        </View>
      </View>
    </Surface>
  );
}

/** A neighbouring card: key art alone, dimmed, tilted and stood back (§6). */
function SideKeyArt({ game }: { readonly game: GameModule | undefined }) {
  if (game === undefined) {
    // Nothing rather than a placeholder: an empty slot beside the focused card
    // would read as a game that failed to draw.
    return null;
  }

  return (
    <View style={styles.sideCardWrapper}>
      <View style={[styles.sideCard, { backgroundColor: colors[game.metadata.keyArt.color] }]}>
        <Text style={styles.sideCardTitle}>{game.metadata.title}</Text>
      </View>
    </View>
  );
}

/** One meta chip under a card's title. */
function Chip({ text, tone }: { readonly text: string; readonly tone?: string }) {
  return (
    <View style={[styles.chip, tone === undefined ? null : { backgroundColor: tone }]}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/**
 * The television with a game on it: the module's own screen, under a header
 * that says only what `GameMetadata` already told the hub.
 *
 * Nothing here knows which game it is drawing — the header is metadata and the
 * stage below it is the module's.
 */
function GameStage({
  module,
  state,
  roster,
}: {
  readonly module: GameModule;
  readonly state: unknown;
  readonly roster: readonly RosterSeat[];
}) {
  // Mounted as a component rather than called as a function, so a game's screen
  // owns its own hooks instead of registering them on this one's list.
  const TvScreen = module.screens.tv;

  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Wordmark height={roomLayout.wordmark} />
          <Text style={styles.gameTitle}>{module.metadata.title}</Text>
        </View>

        <View style={styles.gameStage}>
          <TvScreen state={state} players={gamePlayersFrom(roster)} />
        </View>
      </View>
    </TvStage>
  );
}

/**
 * The room is playing a game this television does not have — an un-updated TV
 * in a room whose phones have moved on. Said out loud rather than drawn as a
 * pairing screen, which would put a Room Code up for a room that is mid-game.
 */
function UnknownGameStage({ gameId }: { readonly gameId: string }) {
  return (
    <TvStage>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Wordmark height={roomLayout.wordmark} />
        </View>

        <View style={styles.center}>
          <Surface elevation={elevation.phoneCard} style={styles.badge}>
            <Text style={styles.badgeText}>UPDATE HUDDLE</Text>
          </Surface>
          <Text style={styles.unknownGameText}>
            This room is playing {gameId}, which this TV doesn’t have yet.
          </Text>
        </View>
      </View>
    </TvStage>
  );
}

/**
 * One tile per letter. The tiles are drawn before the code arrives so the
 * screen does not reflow around it — on a local backend the room opens well
 * inside a couple of frames.
 *
 * Drawing them empty first is what used to blank an I on tvOS. The Code Letter
 * Box fix keeps that no-reflow decision safe: the letter takes its box from the
 * tile, so nothing here depends on measuring a glyph and the full alphabet can
 * be minted again.
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
  if (!caption.trouble) {
    return <Text style={styles.caption}>{caption.text}</Text>;
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
            size={QR_SIZE}
            color={colors.ink}
            backgroundColor={colors.surface}
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
function useCardTransition(
  index: number,
): { readonly transform: readonly [{ translateX: Animated.Value }] } {
  const [slide] = useState(() => new Animated.Value(0));
  const [entry, setEntry] = useState(() => ({ index, offset: 0 }));

  if (entry.index !== index) {
    setEntry({ index, offset: cardEntryOffset(entry.index, index) });
  }

  useLayoutEffect(() => {
    if (entry.offset === 0) {
      return undefined;
    }

    slide.setValue(entry.offset);

    // Ease-out as the handoff writes it, at the duration Boardwalk holds for
    // this animation: fast off the mark and settling into the new card, which
    // is the shape of a carousel that has been *pushed* somewhere rather than
    // one drifting there. Cubic is CSS's own `ease-out` curve.
    const travel = Animated.timing(slide, {
      toValue: 0,
      duration: motionDuration.cardTransition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    travel.start();

    // A Host holding the arrow moves the index again mid-slide; the next
    // transition resets the driver from wherever this one had reached, and a
    // stopped animation is what keeps the two from fighting over it.
    return () => travel.stop();
  }, [entry, slide]);

  return { transform: [{ translateX: slide }] };
}

/**
 * The handoff's avatar pop-in — "scale 0.6→1 with slight overshoot, ~300ms
 * spring" — on the surface it was written for: the avatar of the player who has
 * just joined.
 *
 * It spent a release somewhere else. Boardwalk's television had no seat with a
 * player in it — the carousel replaced the pairing screen at the first join — so
 * the pop-in was hung on the carousel's footer line instead, the same event and
 * the same ~300ms on the only surface that could still carry it. Soft Minimal's
 * Room keeps the roster up, so the spring is back on a face.
 *
 * `Animated.spring` takes physics rather than a duration, so the token is
 * converted (`springOf`) instead of being handed over: a spring's period is the
 * honest reading of "~300ms spring", and the damping ratio is what makes the
 * overshoot slight.
 *
 * Nothing pops for a seat that is merely occupied. A television that sprang
 * every face on the grid whenever it re-rendered would be motion for its own
 * sake — the opposite of Eyes up.
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

// Every measurement below is the handoff's own, at its 1280×720 design size;
// `TvStage` scales the lot to the television.
const styles = StyleSheet.create({
  // No fill. `TvStage`'s artwork *is* the canvas on a TV screen, and this View
  // covers the whole of it — a `colors.screen` here painted the plants out,
  // which is why the background looked like it had failed to load. The only
  // place that colour is painted is `TvStage`'s letterbox bars, exactly as the
  // comment there claims.
  screen: {
    flex: 1,
  },

  // The wordmark's row on the carousel, the game frame and the unknown-game
  // screen — every TV screen except the Room, which needs the mark out of the
  // flow so its title can share the band (`roomWordmark`).
  header: {
    paddingHorizontal: 56,
    paddingTop: roomLayout.headerTop,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  carousel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  // 440×520. This is the TV's focus treatment, which the handoff pins: an
  // orange border at `borderWidth.focus`, and explicitly *not* scale alone —
  // the card is already the largest thing on the screen, so a 1.04 lift reads
  // as nothing from across a room while a 3px orange edge reads immediately.
  focusedCard: {
    width: 440,
    height: 520,
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: borderWidth.focus,
    borderRadius: radius.cardLarge,
  },
  keyArt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    // The card used to clip this to its own corners. It cannot any more —
    // `overflow: 'hidden'` sets `masksToBounds`, which would clip the card's
    // shadow too — so the art rounds its own top corners instead, inset by the
    // focus border so the curve sits inside the orange rather than under it.
    borderTopLeftRadius: radius.cardLarge - borderWidth.focus,
    borderTopRightRadius: radius.cardLarge - borderWidth.focus,
  },
  keyArtTitle: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontSize: 46,
    lineHeight: 52,
    textAlign: 'center',
  },
  cardInfo: {
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 22,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 38,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.chip,
  },
  chipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
  },

  // 300×400 at half opacity and stood back, per §6. The tilt comes from
  // Boardwalk's own sticker rotation rather than a number invented here.
  sideCardWrapper: {
    opacity: opacity.carouselSideCard,
    transform: [{ scale: 0.94 }],
  },
  sideCard: {
    width: 300,
    height: 400,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.cardLarge,
  },
  sideCardTitle: {
    color: colors.surface,
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    textAlign: 'center',
  },

  // The dots and the line side by side rather than stacked. §6 asks for "page
  // dots + '<Host> is browsing on their phone'" and does not say in which
  // direction, and one row is 28pt of content instead of 56: the footer goes
  // 92 → 64, the card lands at 124→644 with its 10px cobalt shadow to 654, and
  // the dots sit at 664. Ten points of daylight under the shadow the active dot
  // used to disappear into, with every pinned §6 number left alone — the
  // arithmetic and the two nudges that did not work are in the plan.
  //
  // `justifyContent` is load-bearing rather than decorative: `screen` stretches
  // this footer across the full 1280pt, so a row without it packs the dots and
  // the line against the left edge. `alignItems` stays and changes meaning —
  // it now centres the two on each other's line.
  carouselFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 36,
  },
  pageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
  },
  // The active dot is a cobalt pill with an ink border (§6).
  pageDotActive: {
    width: 32,
    backgroundColor: colors.accent,
    borderColor: colors.ink,
    borderWidth: borderWidth.hairline,
  },
  browsingLine: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 22,
    lineHeight: FOOTER_TEXT_LINE,
  },

  gameTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 34,
  },
  // Where the module draws — the whole stage under the header. A game that
  // draws nothing leaves the Boardwalk canvas showing, which is the honest
  // picture until the TV question screens land.
  gameStage: {
    flex: 1,
    alignSelf: 'stretch',
  },
  // The unknown-game screen's own three: a centred stack with a badge over a
  // sentence. It is the last surface in the app with no design behind it, and
  // these are kept together and to itself so that whoever draws it — or deletes
  // it — has one block to take.
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  badge: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  badgeText: {
    color: colors.inverse,
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    letterSpacing: letterSpacing.badge,
  },
  unknownGameText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 22,
    textAlign: 'center',
  },

  // ————— Room —————
  //
  // The whole screen is one column with pinned gaps rather than flexed space,
  // because everything on it has to fit at a *full* room and 720pt is not
  // generous. Flexing the middle instead would let the grid decide where the
  // room code sits, which is the one thing on the screen somebody is trying to
  // read off a photograph of their own television.
  //
  // The column, summed, is `roomScreenHeight()` in `../src/roster` — and it is
  // summed *there* rather than described here so that a test can hold it under
  // the handoff's 64pt TV safe margin. A comment cannot: the first draft of this
  // one claimed 666 against a stack that actually measured 684, which is 28pt
  // inside the margin it was claiming to clear. Every `marginTop` below is one
  // of that function's terms; move one and the test says so.

  // The board sets this as a plain heading rather than the pill Boardwalk used:
  // Soft Minimal has one accent and it is spent on things you act on.
  // The wordmark's gutter position, out of the column's flow.
  roomWordmark: {
    position: 'absolute',
    top: roomLayout.headerTop,
    left: 56,
  },
  // 40/48, which is the handoff's TV Title step. The board draws this nearer
  // 33, and the scale wins: a one-off size on one screen is how a type scale
  // stops being one. The disagreement is recorded in the handoff.
  roomTitle: {
    color: colors.ink,
    fontFamily: fontFamily.bold,
    fontSize: 40,
    lineHeight: roomLayout.titleLine,
    marginTop: roomLayout.titleTop,
    textAlign: 'center',
  },
  // The code column and the QR beside it, centred on each other's middle.
  //
  // `marginLeft` is the board's own asymmetry, measured rather than invented.
  // The board centres the *title* on the stage (ink centre 642 of 1280) but not
  // this row: the tiles sit at 390–797 and the QR at 840–967, putting the pair's
  // centre 38pt right of the stage's. So the group is nudged by twice that
  // through the padding, and the tiles land under the heading where the board
  // has them instead of dragged left by the QR's weight.
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 43,
    marginTop: roomLayout.heroGap,
    marginLeft: 76,
  },
  codeGroup: {
    alignItems: 'center',
    gap: roomLayout.tileCaptionGap,
  },
  tiles: {
    flexDirection: 'row',
    gap: 23,
  },
  // Down from Boardwalk's 148×176. The tiles gave up the middle of the screen
  // when the roster moved onto it, and a room code is still legible across a
  // room at an 84pt tile: the letter is 52px of SemiBold navy on white, which
  // is more than twice the 22px body this television reads at.
  tile: {
    width: roomLayout.tile,
    height: roomLayout.tile,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.card,
  },
  tileLetter: {
    // The letter fills its tile and is centred in it, rather than sizing itself
    // to its own glyph — which is what keeps an I from vanishing on tvOS. See
    // `codeLetterBox`; it carries the whole story.
    ...codeLetterBox,
    color: colors.ink,
    fontFamily: fontFamily.semibold,
    fontSize: 52,
    // Inter's line box is taller than its caps; pinning it keeps the letter
    // optically centred in the tile instead of riding low.
    lineHeight: 58,
  },
  caption: {
    color: colors.mutedText,
    fontFamily: fontFamily.regular,
    fontSize: 22,
    lineHeight: roomLayout.captionLine,
  },
  // The caption's slot, on the soft peach accent surface, when the news is that
  // nothing is working.
  troubleChip: {
    // Exactly the caption's line, so the stack below it does not move when the
    // news turns bad — `roomScreenHeight` has one answer, not two.
    height: roomLayout.captionLine,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.soft,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.pill,
  },
  troubleChipText: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    // The caption's own size: this is the one line on the screen that has to be
    // read and acted on.
    fontSize: 22,
  },
  // 128 square on the board, around a 95pt bitmap.
  qrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.card,
  },
  qr: {
    width: QR_SIZE,
    height: QR_SIZE,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: roomLayout.dividerGap,
    // The board's rule runs 165–1107 of 1280.
    paddingHorizontal: 168,
  },
  dividerRule: {
    flex: 1,
    height: borderWidth.hairline,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: minBodyFontSize.tv,
    letterSpacing: letterSpacing.label,
    lineHeight: roomLayout.dividerLine,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    justifyContent: 'center',
    columnGap: seat.columnGap,
    rowGap: seat.rowGap,
    marginTop: roomLayout.gridGap,
    // Exactly `SEATS_PER_ROW` seats wide, so the wrap happens where the design
    // says it does rather than wherever the stage runs out — a grid that broke
    // on available width would silently become 6×2 the first time a measurement
    // moved, and the room caps at ten.
    width: SEATS_PER_ROW * seat.width + (SEATS_PER_ROW - 1) * seat.columnGap,
  },
  seat: {
    width: seat.width,
    height: SEAT_HEIGHT,
    alignItems: 'center',
  },
  seatAvatar: {
    width: seat.avatar,
    height: seat.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  // A place nobody has taken: the board's dashed circle with its number in it.
  //
  // Both are a step darker than the board draws them, and than `colors.border`
  // — which is what a divider is for and measures 1.19:1 against this canvas.
  // These circles are not a divider: "there is room for you" is the whole
  // message of an empty room, read from a sofa, and a ring nobody can see does
  // not carry it. `colors.away` takes the ring to 2.37:1 and `mutedText` takes
  // the number past the 3:1 the repo already holds large text to.
  seatAvatarEmpty: {
    borderColor: colors.away,
    borderWidth: borderWidth.hairline,
    borderStyle: 'dashed',
  },
  seatNumber: {
    color: colors.mutedText,
    fontFamily: fontFamily.medium,
    fontSize: 24,
  },
  seatName: {
    color: colors.ink,
    fontFamily: fontFamily.medium,
    fontSize: 20,
    lineHeight: seat.nameLine,
    marginTop: seat.nameGap,
    // A long nickname is truncated rather than wrapped: the seat is one line
    // tall by construction, and a name on two lines would push its own status
    // slot out of the row it shares with four others.
    maxWidth: seat.width,
  },
  seatHost: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.tv,
    letterSpacing: letterSpacing.label,
    lineHeight: seat.statusLine,
    marginTop: seat.statusGap,
  },
  seatDot: {
    width: 12,
    height: 12,
    backgroundColor: colors.online,
    borderRadius: radius.pill,
    marginTop: seat.statusGap + (seat.statusLine - 12) / 2,
  },
  seatChip: {
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    marginTop: seat.statusGap,
  },
  seatChipAway: {
    backgroundColor: colors.border,
  },
  seatChipJustJoined: {
    backgroundColor: colors.justJoined,
  },
  seatChipText: {
    fontFamily: fontFamily.semibold,
    fontSize: minBodyFontSize.tv,
    // Half the label tracking the HOST slot wears. `JUST JOINED!` is twelve
    // characters in a column sized for a nickname, and full tracking spends
    // 22pt of it on air — enough to wrap the chip onto a second line and take
    // its seat out of the row with it.
    letterSpacing: letterSpacing.label / 2,
    lineHeight: seat.statusLine,
    // The tracking is applied *between* letters and after the last one too, so
    // a centred all-caps chip reads a point or two left of centre without this.
    marginRight: -letterSpacing.label / 2,
  },
  seatChipTextAway: {
    color: colors.mutedText,
  },
  seatChipTextJustJoined: {
    color: colors.inverse,
  },

  countLine: {
    color: colors.mutedText,
    fontFamily: fontFamily.regular,
    fontSize: 22,
    lineHeight: roomLayout.countLine,
    marginTop: roomLayout.countGap,
    textAlign: 'center',
  },
  countJoined: {
    color: colors.accent,
    fontFamily: fontFamily.semibold,
  },
});
